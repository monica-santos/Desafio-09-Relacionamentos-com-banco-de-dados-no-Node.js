import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) throw new AppError('Could not find customer');

    const foundProducts = await this.productsRepository.findAllById(products);

    if (!foundProducts.length) throw new AppError('Could not find any product');

    if (foundProducts.length !== products.length) {
      throw new AppError('Could not find some of the products');
    }

    // const hasStock = foundProducts.reduce((acc, cur) => {
    //   const product = products.find(prod => prod.id === cur.id)
    //   if (product?.quantity > cur.quantity) return;
    // }, false)

    const hasInsuficientStock = foundProducts.some(product => {
      const found = products.find(prod => prod.id === product.id) as IProduct;
      return found.quantity > product.quantity;
    });

    if (hasInsuficientStock) {
      throw new AppError('Out of Stock');
    }

    const order = await this.ordersRepository.create({
      customer,
      products: products.map(prod => ({
        product_id: prod.id,
        quantity: prod.quantity,
        price: foundProducts.filter(p => p.id === prod.id)[0].price,
      })),
    });
    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(prod => ({
      id: prod.product_id,
      quantity:
        foundProducts.filter(p => p.id === prod.product_id)[0].quantity -
        prod.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
