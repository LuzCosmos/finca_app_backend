import { ApiProperty } from "@nestjs/swagger";
import { Cattle } from "src/modules/farm/entities/cattle.entity";
import { AnimalSimpleEvent } from "src/modules/massive-events/entities/animal-simple-event.entity";
import { SimpleEventType } from "src/modules/massive-events/enums/simple-event-type.enum";

export class ReceiveCattleResponseDto {
    @ApiProperty({ example: 'uuid', description: 'id' })
    id: string;

    @ApiProperty({ example: 'uuid', description: 'idTenant' })
    idTenant: string;

    @ApiProperty({ example: 'C-001', description: 'sysnumber' })
    sysnumber: string;

    @ApiProperty({ example: 'C-001', description: 'number' })
    number: string;

    @ApiProperty({ example: 'uuid', description: 'idLot' })
    idLot?: string;

    @ApiProperty({ example: 'uuid', description: 'idBrand' })
    idBrand?: string;

    @ApiProperty({ example: 'color_enum', description: 'color' })
    color?: string;

    @ApiProperty({ example: 'uuid', description: 'idDevice' })
    idDevice?: string;

    @ApiProperty({ example: 'C-001', description: 'eartagLeft' })
    eartagLeft?: string;

    @ApiProperty({ example: 'C-002', description: 'eartagRight' })
    eartagRight?: string;

    @ApiProperty({ example: 'Tracker 1', description: 'deviceName' })
    deviceName?: string;

    @ApiProperty({ example: 'appliedEvents', description: 'appliedEvents' })
    appliedEvents: Array<{
        type: SimpleEventType;
        data: any;
        appliedBy?: string;
        appliedAt?: Date;
        idSimpleEvent: string;
    }>;

    static toResponseDto(cattle: Cattle, appliedEvents: any[]): ReceiveCattleResponseDto {
        return {
            id: cattle.id,
            idTenant: cattle.idTenant,
            sysnumber: cattle.sysNumber,
            number: cattle.number,
            idLot: cattle.idLot ?? undefined,
            idBrand: cattle.idBrand ?? undefined,
            color: cattle.color ?? undefined,
            idDevice: cattle.idDevice ?? undefined,
            eartagLeft: cattle.eartagLeft ?? undefined,
            eartagRight: cattle.eartagRight ?? undefined,
            deviceName: cattle.device?.name ?? undefined,
            appliedEvents: appliedEvents ?? [],
        };
    }
}

