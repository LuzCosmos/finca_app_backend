
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsDateString, IsEnum, IsString, MaxLength } from 'class-validator';
import { AnimalSimpleEvent } from '../../massive-events/entities/animal-simple-event.entity';
import { Cattle } from '../../farm/entities/cattle.entity';
import { Lot } from '../../commerce/entities/lot.entity';
import { PurchaseReception } from '../entities/purchase-reception.entity';
import { Purchase } from '../../commerce/entities/purchase.entity';
import { MassiveEvent } from '../../massive-events/entities/massive-events.entity'
import { SimpleEventResponseDto } from 'src/modules/massive-events/dto/simple-event-response.dto';
import { Color } from '../../farm/entities/color.entity';
import { Characteristic } from '../../farm/entities/characteristic.entity';

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
      deviceName: '',
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
  purchaseCattleCount: number;

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
      purchaseCattleCount: entity.cattleCount,
      totalWeight: entity.totalWeight,
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

  @ApiProperty({ format: 'uuid', description: 'ID del proveedor (provider) a la cual se asocia la recepción' })
  @IsUUID()
  providerId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'ID del evento masivo a crear junto con la recepción.' })
  @IsOptional() @IsUUID()
  massEventId?: string;

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
  @IsOptional() @IsDateString()
  receivedAt?: string;

  @ApiProperty({ type: [LotReceptionResponseDto], description: 'List of lots involved in this reception' })
  lots: LotReceptionResponseDto[];

  @ApiProperty({ type: [CattleReceptionResponseDto], description: 'List of cattle involved in this reception' })
  cattle: CattleReceptionResponseDto[];

  @ApiProperty({ type: [ReceptionMassiveEventResponseDto], description: 'List of massive events involved in this reception' })
  massiveEvent: ReceptionMassiveEventResponseDto;


  static toResponseDto(entity: PurchaseReception, purchase: Purchase, providerName: string,
    lots: Lot[], lotCattle: Record<string, Cattle[]>, cattle: Cattle[],
    appliedEvents: Record<string, AnimalSimpleEvent[]>, massiveEvent: MassiveEvent,
  ): PurchaseReceptionResponseDto {

    var responseLots: LotReceptionResponseDto[] = [];
    for (const l of lots) {
      responseLots.push(LotReceptionResponseDto.toResponseDto(l, lotCattle[l.id], appliedEvents));
    }
    var responseCattle: CattleReceptionResponseDto[] = [];
    for (const c of cattle) {
      responseCattle.push(CattleReceptionResponseDto.toResponseDto(c, appliedEvents[c.id]));
    }

    return {
      id: entity.id,
      purchaseId: entity.idPurchase,
      providerId: purchase.idProvider,
      purchaseDate: new Date(purchase.purchaseDate).toISOString(),
      purchaseProviderName: providerName,
      lots: responseLots,
      cattle: responseCattle,
      massiveEvent: ReceptionMassiveEventResponseDto.toResponseDto(massiveEvent),
    };
  }
}

export class ColorResponseDto {
  @ApiProperty({ format: 'uuid', description: 'ID de la color' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: 'Black', description: 'Nombre de la color' })
  @IsString()
  name: string;

  static toResponseDto(entity: Color): ColorResponseDto {
    return {
      id: entity.id,
      name: entity.name,
    };
  }
}

export class CharacteristicResponseDto {
  @ApiProperty({ format: 'uuid', description: 'ID de la característica' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: 'White Belly', description: 'Nombre de la característica' })
  @IsString()
  name: string;

  static toResponseDto(entity: Characteristic): CharacteristicResponseDto {
    return {
      id: entity.id,
      name: entity.name,
    };
  }
}


export class ReceptionResponseDto {

  @ApiProperty({ type: PurchaseReceptionResponseDto, description: 'Purchase reception' })
  reception: PurchaseReceptionResponseDto;

  @ApiProperty({ type: [ColorResponseDto], description: 'List of colors' })
  colors: ColorResponseDto[];

  @ApiProperty({ type: [CharacteristicResponseDto], description: 'List of characteristics' })
  characteristics: CharacteristicResponseDto[];


  static toResponseDto(receptionInfo: PurchaseReceptionResponseDto, colors: Color[], characteristics: Characteristic[]
  ): ReceptionResponseDto {

    var colorsResponse: ColorResponseDto[] = [];
    for (const c of colors) {
      colorsResponse.push(ColorResponseDto.toResponseDto(c));
    }
    var characteristicsResponse: CharacteristicResponseDto[] = [];
    for (const c of characteristics) {
      characteristicsResponse.push(CharacteristicResponseDto.toResponseDto(c));
    }
    console.log('colorsResponse', colorsResponse);
    console.log('characteristicsResponse', characteristicsResponse);
    return {
      reception: receptionInfo,
      colors: colorsResponse,
      characteristics: characteristicsResponse,

    };
  }

  static toResponseDto_optional(entity: PurchaseReception, purchase: Purchase, providerName: string,
    lots: Lot[], lotCattle: Record<string, Cattle[]>, cattle: Cattle[],
    appliedEvents: Record<string, AnimalSimpleEvent[]>, massiveEvent: MassiveEvent,
    colors: Color[], characteristics: Characteristic[]
  ): ReceptionResponseDto {

    var colorsResponse: ColorResponseDto[] = [];
    for (const c of colors) {
      colorsResponse.push(ColorResponseDto.toResponseDto(c));
    }
    var characteristicsResponse: CharacteristicResponseDto[] = [];
    for (const c of characteristics) {
      characteristicsResponse.push(CharacteristicResponseDto.toResponseDto(c));
    }

    var receptionInfo = PurchaseReceptionResponseDto.toResponseDto(entity, purchase, providerName, lots, lotCattle, cattle, appliedEvents, massiveEvent);
    return {
      reception: receptionInfo,
      colors: colorsResponse,
      characteristics: characteristicsResponse,

    };
  }



}