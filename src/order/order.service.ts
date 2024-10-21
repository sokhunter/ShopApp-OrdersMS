import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto, PaidOrderDto } from './dto';
import { NATS_SERVICE } from 'src/config';
import { catchError, firstValueFrom } from 'rxjs';
import { OrderWithProducts } from './interfaces/order-with-products.interface';

@Injectable()
export class OrderService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrderService');

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database Conected');
  }

  async create(createOrderDto: CreateOrderDto) {
    const productsId = createOrderDto.items.map((item) => item.productId);
    const products = await firstValueFrom(
      this.client.send({ cmd: 'validateProducts' }, productsId).pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      ),
    );

    const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
      const price = products.find(
        (product) => product.id === orderItem.productId,
      ).price;
      return price * orderItem.quantity + acc;
    }, 0);

    const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
      return acc + orderItem.quantity;
    }, 0);
    const order = await this.order.create({
      data: {
        totalAmount,
        totalItems,
        OrderItem: {
          createMany: {
            data: createOrderDto.items.map((orderItem) => ({
              productId: orderItem.productId,
              price: products.find(
                (product) => product.id === orderItem.productId,
              ).price,
              quantity: orderItem.quantity,
            })),
          },
        },
      },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true,
          },
        },
      },
    });
    return {
      ...order,
      OrderItem: order.OrderItem.map((item) => ({
        ...item,
        name: products.find((product) => product.id === item.productId).name,
      })),
    };
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const totalItems = await this.order.count({
      where: {
        status: orderPaginationDto.status,
      },
    });
    const currentPage = orderPaginationDto.page;
    const perPage = orderPaginationDto.limit;

    return {
      data: await this.order.findMany({
        skip: (currentPage - 1) * perPage,
        take: perPage,
        where: {
          status: orderPaginationDto.status,
        },
      }),
      meta: {
        total: totalItems,
        page: currentPage,
        lastPage: Math.ceil(totalItems / perPage),
      },
    };
  }

  async findOne(id: string) {
    let order;
    try {
      order = await this.order.findFirstOrThrow({
        where: { id },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(error);
      throw new RpcException({
        message: `Order with id ${id} not found`,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const productsId = order.OrderItem.map((item) => item.productId);
    const products = await firstValueFrom(
      this.client.send({ cmd: 'validateProducts' }, productsId).pipe(
        catchError((error) => {
          throw new RpcException(error);
        }),
      ),
    );

    return {
      ...order,
      OrderItem: order.OrderItem.map((item) => ({
        ...item,
        name: products.find((product) => product.id === item.productId).name,
      })),
    };
  }

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;
    const order = await this.findOne(id);
    if (order.status === status) {
      return order;
    }
    return this.order.update({
      where: { id },
      data: { status },
    });
  }

  async createPaymentSession(order: OrderWithProducts) {
    const paymentSession = await firstValueFrom(
      this.client.send('create.payments.session', {
        orderId: order.id,
        currency: 'usd',
        items: order.OrderItem.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      }),
    );
    return paymentSession;
  }

  async paidOrder(paidOrderDto: PaidOrderDto) {
    this.logger.log('Order Paid');
    this.logger.log(paidOrderDto);
    const order = await this.order.update({
      where: { id: paidOrderDto.orderId },
      data: {
        status: 'PAID',
        paid: true,
        paidAt: new Date(),
        stripeChargeId: paidOrderDto.stripePaymentId,
        OrderRecipt: {
          create: {
            reciptUrl: paidOrderDto.reciptUrl,
          },
        },
      },
    });
    return order;
  }
}
