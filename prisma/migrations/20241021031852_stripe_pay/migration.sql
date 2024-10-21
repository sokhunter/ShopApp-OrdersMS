-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PAID';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "stripeChargeId" TEXT;

-- CreateTable
CREATE TABLE "OrderRecipt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reciptUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderRecipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderRecipt_orderId_key" ON "OrderRecipt"("orderId");

-- AddForeignKey
ALTER TABLE "OrderRecipt" ADD CONSTRAINT "OrderRecipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
