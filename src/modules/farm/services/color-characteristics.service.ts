import { Injectable } from "@nestjs/common";
import { CattleColor } from "../enums/cattle-color.enum";
import { CattleCharacteristicEnum } from "../enums/cattle-characteristic.enum";

@Injectable()
export class ColorCharacteristicsService {
    constructor() { }

    getAllColors() {
        return Object.values(CattleColor);
    }

    getAllCharacteristics() {
        return Object.values(CattleCharacteristicEnum);
    }
}