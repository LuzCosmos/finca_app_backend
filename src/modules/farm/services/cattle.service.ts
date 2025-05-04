import { Injectable, NotFoundException, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Cattle } from '../entities/cattle.entity';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';
import { CattleRepository } from '../repositories/cattle.repository';
import { CattleDeviceAssignmentRepository } from '../repositories/cattleDeviceAssignment.repository';
import { DevicesService } from '../../production-center/services/devices.service';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
@Injectable()
export class CattleService {

  private readonly logger: Logger = new Logger(CattleService.name);

  constructor(
    private readonly cattleRepository: CattleRepository,
    private readonly cattleDeviceAssignmentRepository: CattleDeviceAssignmentRepository,
    private readonly deviceService: DevicesService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create or update a cattle with device tags
   * @param idTenant - The tenant ID
   * @param dto - The cattle data
   * @returns The created or updated cattle
   */
  async createOrUpdateWithDeviceTags(idTenant: string, dto: CreateCattleDto, idcattle?: string): Promise<Cattle> {
    if (!dto.deveui) {
      throw new BadRequestException("El campo deveui es requerido para esta operación");
    }
    const device = await this.deviceService.findOne(dto.deveui, idTenant);
    if (!device) {
      throw new NotFoundException(`Device ${dto.deveui} not found`);
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      dto.idDevice = device.id;
      // Crear una copia del DTO sin el campo deveui
      const { deveui, ...dtoWithoutDeveui } = dto;
      let cattle: Cattle | undefined;
      if (idcattle) {
        cattle = await this.cattleRepository.update(idTenant, idcattle, dtoWithoutDeveui as UpdateCattleDto, manager);
      } else {
       cattle = await this.cattleRepository.create(dtoWithoutDeveui as CreateCattleDto, manager);
      }
      if (!cattle) throw new NotFoundException(`Cattle ${idcattle} not found`);
      const cattleDeviceAssignment = await this.cattleDeviceAssignmentRepository.assignDeviceToCattle(dto.idDevice, cattle.id, manager);
      const deviceUpdateDto = {
        applicationId: device.csApplicationId,
        description: device.description,
        name: device.name,
        tags: {id_cattle: cattle.id, id_device: dto.idDevice}
      };
      const deviceTags = await this.deviceService.updateWithDevive(device, deviceUpdateDto, manager);
      await queryRunner.commitTransaction();
      return cattle;
    } catch (error) {
      this.logger.error(error);
      await queryRunner.rollbackTransaction();
      throw new BadRequestException("Error saving the cattle with the device");
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create a new cattle
   * @param idTenant - The tenant ID
   * @param data - The cattle data
   * @returns The created cattle
   */
  async create(idTenant: string, data: CreateCattleDto): Promise<Cattle> {
    data.idTenant = idTenant;
    if (!data.deveui) {
      return this.cattleRepository.create(data);
    }
    return this.createOrUpdateWithDeviceTags(idTenant, data);
  }

  /**
   * Find a cattle by ID
   * @param idTenant - The tenant ID
   * @param id - The cattle ID
   * @returns The found cattle
   */
  async findOne(idTenant: string, id: string): Promise<Cattle> {
    const cattle = await this.cattleRepository.findOne(idTenant, id);
    if (!cattle) throw new NotFoundException(`Cattle ${id} not found`);
    return cattle;
  }

  /**
   * Update a cattle
   * @param idTenant - The tenant ID
   * @param id - The cattle ID
   * @param data - The cattle data
   * @returns The updated cattle
   */
  async update(idTenant: string, id: string, data: UpdateCattleDto): Promise<Cattle> {
    if (data.deveui) {
      return this.createOrUpdateWithDeviceTags(idTenant, data as CreateCattleDto, id);
    } else {
      const cattle = await this.cattleRepository.update(idTenant, id, data);
      if (!cattle) throw new NotFoundException(`Cattle ${id} not found`);
      return cattle;
    }
  }

  async remove(idTenant: string, id: string): Promise<void> { 
    await this.cattleRepository.delete(idTenant, id);
  }

  list(idTenant: string): Promise<Cattle[]> {
    return this.cattleRepository.findAll(idTenant);
  }

  async import(file: Express.Multer.File, idTenant: string): Promise<any[]> {
    try {
      if (!file || !file.path) {
        throw new BadRequestException('No se ha proporcionado un archivo válido');
      }
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new BadRequestException('The Excel sheet does not exist or is empty'); 
      }
      const datos = await this.processSheet(worksheet, idTenant);
      return datos;
    } catch (error) {
      this.logger.error(`Error importing file: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error processing the Excel file: ${error.message}`);
    } finally {
      if (file && file.path) {
        try {
          fs.unlink(file.path, (err) => {
            if (err) {
              this.logger.error(`Error deleting file ${file.path}: ${err.message}`);
            } else {
              this.logger.debug(`File ${file.originalname} deleted from ${file.path}`);
            }
          });
        } catch (unlinkError) {
          this.logger.error(`Error in finally block: ${unlinkError.message}`);
        }
      }
    }
  }

  async processSheet(worksheet: ExcelJS.Worksheet, idTenant: string): Promise<any> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<string>,
    };
    // Verificar si hay filas para procesar
    if (worksheet.rowCount < 2) {
      results.errors.push('El archivo Excel no contiene datos para procesar');
      return results;
    }
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      try {
        const row = worksheet.getRow(rowNumber);
          const rowValues = Array.isArray(row.values)
          ? row.values.slice(1).map((v: any) =>
              typeof v === 'object' && v?.result !== undefined ? v.result : v,
            )
          : [];
        if (rowValues.length === 0) {
          results.errors.push(`Row ${rowNumber} is empty`);
          results.failed++;
          continue;
        }
        if (rowValues.length < 24) {
          results.errors.push(`Row ${rowNumber} has not enough columns (it has ${rowValues.length} columns, it should have 24 )`);
          results.failed++;
          continue;
        }
        try {
          const cattle = await this.processExcelRow(rowValues, rowNumber, idTenant);
          results.success++;
          continue;
        } catch (error) {
          this.logger.error(`Error procesando fila ${rowNumber}: ${error.message}`);
          if (error instanceof BadRequestException) {
            results.errors.push(`Row ${rowNumber}: ${error.message}`);
          } else {
            results.errors.push(`Row ${rowNumber}: Error creating cattle`);
          }
          results.failed++;
        }
      } catch (error) {
        this.logger.error(`Error general en fila ${rowNumber}: ${error.message}`);
        results.errors.push(`Row ${rowNumber}: ${error.message}`);
        results.failed++;
      }
    }
    this.logger.debug(`Procesamiento completado: ${results.success} éxitos, ${results.failed} fallos`);
    return results;
  }

  /**
   * Process a row of the Excel sheet
   * @param rowValues - The row values
   * @param rowNumber - The row number
   * @param idTenant - The tenant ID
   * @returns The created cattle
   */
  async processExcelRow(rowValues: any[], rowNumber: number, idTenant: string): Promise<Cattle> {
    if (!rowValues[0]) {
      throw new BadRequestException(`has no system number`);
    } else {
      const cattle = await this.cattleRepository.findBySysNumberAndTenantId(idTenant, rowValues[0]);
      if (cattle) {
        throw new BadRequestException(`system number ${rowValues[0]} already exists`);
      }
    }
    if (!rowValues[1]) {
      throw new BadRequestException(`system number ${rowValues[0]} has no cattle number`);
    } else {
      const cattle = await this.cattleRepository.findByNumberAndTenantId(idTenant, rowValues[1]);
      if (cattle) {
        throw new BadRequestException(`cattle number ${rowValues[1]} already exists`);
      }
    }
    if (!rowValues[7]) {
      throw new BadRequestException(`system number ${rowValues[0]} has no received at date`);
    }
    if (!rowValues[9]) {
      throw new BadRequestException(`system number ${rowValues[0]} has no reception weight`);
    }
    if (!rowValues[8]) {
      throw new BadRequestException(`system number ${rowValues[0]} has no purchase weight `);
    }
    if (!rowValues[23]) {
      throw new BadRequestException(`system number ${rowValues[0]} has no purchase from `);
    }
    if (!rowValues[13]) {
      throw new BadRequestException(`system number ${rowValues[0]} has no purchase price `);
    }
    const dto = new CreateCattleDto();
    dto.idTenant = idTenant;
    dto.sysNumber = rowValues[0];
    dto.number = rowValues[1];
    if (rowValues[2]) { dto.brand = rowValues[2]; }
    if (rowValues[3]) { dto.colorDescription = rowValues[3]; }
    if (rowValues[4]) { dto.colorMain = rowValues[4]; }
    if (rowValues[5]) { dto.colorFeature = rowValues[5]; }
    if (rowValues[6]) { dto.lot = rowValues[6]; }
    dto.receivedAt = rowValues[7];
    dto.receivedWeight = rowValues[9];
    dto.purchaseWeight = rowValues[8];
    if (rowValues[10]) { dto.comments = rowValues[10]; }
    dto.purchasedFrom = rowValues[23];
    dto.purchasePrice = rowValues[13];
    if (rowValues[14]) { dto.purchaseCommission = rowValues[14]; }
    if (rowValues[15]) { dto.negotiatedPricePerKg = rowValues[15]; }
    if (rowValues[17]) { dto.lotPricePerWeight = rowValues[17]; }
    // Validar y ajustar lot_price_per_weight para evitar desbordamiento
    /*if (rowValues[17]) {
      const value = parseFloat(rowValues[17]);
      if (isNaN(value)) {
        this.logger.warn(`Row ${rowNumber}, system number ${rowValues[0]} has invalid lot_price_per_weight: ${rowValues[17]}`);
        throw new BadRequestException(`system number ${rowValues[0]} has invalid lot_price_per_weight: ${rowValues[17]}`);
      } else if (value > 99999999.99) {
        this.logger.warn(`Row ${rowNumber}, system number ${rowValues[0]} has lot_price_per_weight too large: ${value}, setting to 99999999.99`);
        dto.lotPricePerWeight = 99999999.99;
      } else {
        dto.lotPricePerWeight = value;
      }
    }*/
    if (rowValues[22]) { dto.averageGr = rowValues[22]; }
    if (rowValues[21]) { dto.saleWeight = rowValues[21]; }
    if (rowValues[34]) { dto.salePricePerKg = rowValues[34]; }
    if (rowValues[36]) { dto.salePrice = rowValues[36]; }
    try {
      const cattle = await this.cattleRepository.create(dto);
      return cattle;
    } catch (error) {
      this.logger.error(error);
      this.logger.debug(`Row ${rowNumber}, system number ${rowValues[0]} has error creating cattle. ${error.message}`);
      throw new BadRequestException(`system number ${rowValues[0]} has error creating cattle.`);
    }
  }

}