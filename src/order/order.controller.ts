import { Controller, ParseUUIDPipe } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto, PaidOrderDto } from './dto';
// import { UpdateOrderDto } from './dto/update-order.dto';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @MessagePattern('createOrder')
  async create(@Payload() createOrderDto: CreateOrderDto) {
    const order = await this.orderService.create(createOrderDto);
    const paymentSession = await this.orderService.createPaymentSession(order);
    return {
      order,
      paymentSession,
    };
  }

  @MessagePattern('findAllOrder')
  findAll(@Payload() orderPaginationDto: OrderPaginationDto) {
    return this.orderService.findAll(orderPaginationDto);
  }

  @MessagePattern('findOneOrder')
  findOne(@Payload('id', ParseUUIDPipe) id: string) {
    return this.orderService.findOne(id);
  }

  @MessagePattern('changeOrderStatus')
  changeStatus(@Payload() changeOrderStatusDto: ChangeOrderStatusDto) {
    return this.orderService.changeStatus(changeOrderStatusDto);
  }

  @EventPattern('payment.succeeded')
  paidOrder(@Payload() paidOrderDto: PaidOrderDto) {
    return this.orderService.paidOrder(paidOrderDto);
  }
}
