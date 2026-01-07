
import { CreateColorDto, CreateCharacteristicDto } from "../dto/color-characteristic.dto";
import { EntityManager } from "typeorm";
import { Injectable } from "@nestjs/common";
import { Color } from "../entities/color.entity";
import { DataSource } from "typeorm";
import { ColorRepository } from "../repositories/color.repository";
import { CharacteristicRepository } from "../repositories/characteristic.repository";
import { Characteristic } from "../entities/characteristic.entity";

@Injectable()
export class ColorCharacteristicsService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly colorRepository: ColorRepository,
        private readonly characteristicRepository: CharacteristicRepository
    ) { }

    createColor(idTenant: string, dto: CreateColorDto, manager?: EntityManager) {
        console.log(dto);
        return this.colorRepository.getOrCreateByNameCI(idTenant, dto.name, manager);
    }

    createCharacteristic(idTenant: string, dto: CreateCharacteristicDto, manager?: EntityManager) {
        return this.characteristicRepository.getOrCreateByNameCI(idTenant, dto.name, dto.groupName, manager);
    }

    getAllColors(idTenant: string, manager?: EntityManager) {
        return this.colorRepository.listActive(idTenant, manager);
    }

    getAllCharacteristics(idTenant: string, manager?: EntityManager) {
        return this.characteristicRepository.listActive(idTenant, manager);
    }
}