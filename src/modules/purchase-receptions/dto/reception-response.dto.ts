
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsDateString, IsEnum, IsString, MaxLength, isString } from 'class-validator';
import { AnimalSimpleEvent } from '../../massive-events/entities/animal-simple-event.entity';
import { Cattle } from '../../farm/entities/cattle.entity';
import { Lot } from '../../commerce/entities/lot.entity';
import { PurchaseReception } from '../entities/purchase-reception.entity';
import { Purchase } from '../../commerce/entities/purchase.entity';
import { MassiveEvent } from '../../massive-events/entities/massive-events.entity'
import { SimpleEventResponseDto } from 'src/modules/massive-events/dto/simple-event-response.dto';

export class AnimalSimpleEventReceptionResponseDto {

  @ApiProperty({ format: 'uuid', description: 'ID del evento simple' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: { kg: 420 }, description: 'Datos del evento' })
  data: any;

  @ApiProperty({ example: '2025-01-01', description: 'Fecha de aplicación' })
  appliedAt: string;

  static toResponseDto(entity: AnimalSimpleEvent): AnimalSimpleEventReceptionResponseDto {
    return {
      id: entity.id,
      data: entity.data,
      appliedAt: entity.appliedAt.toISOString(),
    };
  }
}

export class CattleReceptionResponseDto {
  @ApiProperty({ format: 'uuid', description: 'ID del animal' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: '1234', description: 'Número de res' })
  number: string;

  @ApiProperty({ example: '1234', description: 'Número de sistema de la res' })
  sysNumber: string;

  @ApiProperty({ example: 420, description: 'Peso (kg) del animal recibido' })
  receivedWeight: number;

  @ApiProperty({ example: '1234', description: 'ID del dispositivo' })
  idDevice: string;

  @ApiProperty({ example: 'Dispositivo 1', description: 'Nombre del dispositivo' })
  deviceName: string;

  @ApiProperty({ example: '1234', description: 'Arete/Caravana del animal' })
  eartag?: string;

  @ApiProperty({ example: [{ id: '1234', type: 'weight', data: { kg: 420 }, appliedAt: '2025-01-01' }], description: 'Eventos simples aplicados' })
  appliedEvents: AnimalSimpleEventReceptionResponseDto[];

  static toResponseDto(entity: Cattle, appliedEvents: AnimalSimpleEvent[]): CattleReceptionResponseDto {
    return {
      id: entity.id,
      number: entity.number,
      sysNumber: entity.sysNumber,
      receivedWeight: entity.receivedWeight,
      idDevice: entity.idDevice ?? '',
      deviceName: entity.device?.name ?? '-',
      eartag: entity.eartag ?? undefined,
      appliedEvents: appliedEvents.map(AnimalSimpleEventReceptionResponseDto.toResponseDto),
    };
  }
}

export class LotReceptionResponseDto {
  @ApiProperty({ format: 'uuid', description: 'ID del lote' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: 'L-001', description: 'Lot number or label' })
  lotNumber: string;

  @ApiProperty({ example: 12, description: 'Number of cattle in the lot' })
  purchasedCattleCount: number;

  @ApiProperty({ example: 8500, description: 'Price per kg of cattle in the lot' })
  pricePerKg: number;

  @ApiProperty({ example: 840.5, description: 'Total weight (kg) of cattle in the lot' })
  totalWeight: number;

  @ApiProperty({ example: 12, description: 'Number of cattle received in the lot' })
  receivedCattleCount: number;

  @ApiProperty({ example: 840.5, description: 'Total weight (kg) of cattle received in the lot' })
  receivedTotalWeight: number;

  @ApiProperty({ type: [CattleReceptionResponseDto], description: 'List of cattle involved in this lot' })
  cattle: CattleReceptionResponseDto[];

  static toResponseDto(entity: Lot, lotCattle: Cattle[], appliedEvents: Record<string, AnimalSimpleEvent[]>): LotReceptionResponseDto {
    var cattles: CattleReceptionResponseDto[] = [];
    for (const c of lotCattle) {
      cattles.push(CattleReceptionResponseDto.toResponseDto(c, appliedEvents[c.id]));
    }
    return {
      id: entity.id,
      lotNumber: entity.lotNumber,
      purchasedCattleCount: entity.purchasedCattleCount,
      totalWeight: entity.totalWeight,
      pricePerKg: entity.pricePerKg,
      receivedCattleCount: entity.receivedCattleCount,
      receivedTotalWeight: entity.receivedTotalWeight,
      cattle: cattles,
    };
  }
}

export class ReceptionMassiveEventResponseDto {
  @ApiProperty({ format: 'uuid', description: 'ID del evento masivo' })
  @IsUUID()
  id: string;

  @ApiProperty({ type: [SimpleEventResponseDto], description: 'List of simple events involved in this massive event' })
  simpleEvents: SimpleEventResponseDto[];

  @ApiProperty({ example: 'open', description: 'Status of the massive event' })
  status: string;

  static toResponseDto(entity: MassiveEvent): ReceptionMassiveEventResponseDto {
    return {
      id: entity.id,
      status: entity.status,
      simpleEvents: entity.simpleEvents.map(SimpleEventResponseDto.toResponseDto),
    };
  }
}

export class PurchaseReceptionResponseDto {
  @ApiProperty({ format: 'uuid', description: 'ID de la recepción' })
  @IsUUID()
  id: string;

  @ApiProperty({ format: 'uuid', description: 'ID de la compra (purchase) a la cual se asocia la recepción' })
  @IsUUID()
  purchaseId!: string;

  @ApiProperty({ example: 'OPEN', description: 'Status of the purchase' })
  @IsString()
  purchaseStatus: string;

  @ApiProperty({ format: 'uuid', description: 'ID del proveedor (provider) a la cual se asocia la recepción' })
  @IsUUID()
  providerId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'ID del evento masivo a crear junto con la recepción.' })
  @IsOptional() @IsUUID()
  massEventId?: string;

  @ApiPropertyOptional({ format: 'number', description: 'posible next cattle number for reception' })
  @IsOptional()
  nextCattleNumber?: string;

  @ApiPropertyOptional({
    description: 'Fecha/hora efectiva de la compra.',
    type: String, format: 'date-time'
  })
  @IsOptional() @IsDateString()
  purchaseDate: string;

  @ApiProperty({ example: 'Ganadería El Porvenir', description: 'Name of the provider of the purchase' })
  purchaseProviderName: string;

  @ApiPropertyOptional({
    description: 'Fecha/hora efectiva de la recepción.',
    type: String, format: 'date-time'
  })
  @ApiProperty({
    description: 'Fecha/hora efectiva de la recepción.',
    type: String, format: 'date-time'
  })
  @IsDateString()
  receivedAt: string;

  @ApiProperty({ type: [LotReceptionResponseDto], description: 'List of lots involved in this reception' })
  lots: LotReceptionResponseDto[];

  @ApiProperty({ type: [CattleReceptionResponseDto], description: 'List of cattle involved in this reception' })
  cattle: CattleReceptionResponseDto[];

  @ApiProperty({ type: [ReceptionMassiveEventResponseDto], description: 'List of massive events involved in this reception' })
  massiveEvent: ReceptionMassiveEventResponseDto;

  @ApiProperty({ example: 12, description: 'Number of cattle received in the lot' })
  receivedCattleCount: number;

  @ApiProperty({ example: 840.5, description: 'Total weight (kg) of cattle received in the lot' })
  receivedTotalWeight: number;

  @ApiProperty({ example: 12, description: 'Number of cattle purchased in the lot' })
  purchaseCattleCount: number;

  @ApiProperty({ example: 840.5, description: 'Total weight (kg) of cattle purchased in the lot' })
  purchaseTotalWeight: number;

  static toResponseDto(entity: PurchaseReception, purchase: Purchase, providerName: string,
    lots: Lot[], lotCattle: Record<string, Cattle[]>, cattle: Cattle[],
    appliedEvents: Record<string, AnimalSimpleEvent[]>, massiveEvent: MassiveEvent,
  ): PurchaseReceptionResponseDto {
    var receivedCattleCount = 0;
    var receivedTotalWeight = 0;
    var purchaseCattleCount = 0;
    var purchaseTotalWeight = 0;

    var responseLots: LotReceptionResponseDto[] = [];
    for (const l of lots) {
      responseLots.push(LotReceptionResponseDto.toResponseDto(l, lotCattle[l.id], appliedEvents));
      receivedCattleCount += l.receivedCattleCount;
      receivedTotalWeight += l.receivedTotalWeight;
      purchaseCattleCount += l.purchasedCattleCount;
      purchaseTotalWeight += l.totalWeight;
    }
    var responseCattle: CattleReceptionResponseDto[] = [];
    for (const c of cattle) {
      responseCattle.push(CattleReceptionResponseDto.toResponseDto(c, appliedEvents[c.id]));
      receivedCattleCount += 1;
      receivedTotalWeight += c.receivedWeight;
    }

    return {
      id: entity.id,
      purchaseId: entity.idPurchase,
      providerId: purchase.idProvider,
      purchaseDate: new Date(purchase.purchaseDate).toISOString(),
      receivedAt: new Date(entity.receivedAt).toISOString(),
      purchaseProviderName: providerName,
      nextCattleNumber: entity.nextCattleNumber,
      lots: responseLots,
      cattle: responseCattle,
      massiveEvent: ReceptionMassiveEventResponseDto.toResponseDto(massiveEvent),
      receivedCattleCount: receivedCattleCount,
      receivedTotalWeight: receivedTotalWeight,
      purchaseCattleCount: purchaseCattleCount,
      purchaseTotalWeight: purchaseTotalWeight,
      purchaseStatus: purchase.status,
    };
  }
}


export class ReceptionResponseDto {

  @ApiProperty({ type: PurchaseReceptionResponseDto, description: 'Purchase reception' })
  reception: PurchaseReceptionResponseDto;

  @ApiProperty({ type: [String], description: 'List of colors' })
  colors: string[];

  @ApiProperty({ type: [String], description: 'List of characteristics' })
  characteristics: string[];


  static toResponseDto(receptionInfo: PurchaseReceptionResponseDto, colors: string[], characteristics: string[]
  ): ReceptionResponseDto {
    return {
      reception: receptionInfo,
      colors: colors,
      characteristics: characteristics,

    };
  }

  static toResponseDto_optional(entity: PurchaseReception, purchase: Purchase, providerName: string,
    lots: Lot[], lotCattle: Record<string, Cattle[]>, cattle: Cattle[],
    appliedEvents: Record<string, AnimalSimpleEvent[]>, massiveEvent: MassiveEvent,
    colors: string[], characteristics: string[]
  ): ReceptionResponseDto {

    var receptionInfo = PurchaseReceptionResponseDto.toResponseDto(entity, purchase, providerName, lots, lotCattle, cattle, appliedEvents, massiveEvent);
    return {
      reception: receptionInfo,
      colors: colors,
      characteristics: characteristics,

    };
  }



}