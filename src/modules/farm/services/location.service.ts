import { Injectable, Logger } from '@nestjs/common';
import { LocationRepository } from '../repositories/location.repository';
import { CreateLocationDto } from '../dto/create-location.dto';
import { UpdateLocationDto } from '../dto/update-location.dto';
import { Location } from '../entities/location.entity';

@Injectable()
export class LocationService {
  private readonly logger: Logger;

  constructor(
    private readonly locationRepository: LocationRepository,
  ) {
    this.logger = new Logger(LocationService.name);
  }

  /**
   * Create a new location
   * @param data - The location data
   * @returns The created location
   */
  async create(data: CreateLocationDto): Promise<Location> {
    const location = await this.locationRepository.createLocation(data);
    if(location) {
      this.logger.log(`Location created: ${location.id}`, location);
    }
    return location;
  }

  /**
   * Find the latest location by cattle ID
   * @param idCattle - The ID of the cattle
   * @param idTenant - The ID of the tenant
   * @returns The latest location or null if no location is found
   */
  findByCattle(idCattle: string, idTenant: string) {
    return this.locationRepository.findLatestByCattle(idCattle, idTenant);
  }

  /**
   * Find the latest location by device ID
   * @param idDevice - The ID of the device
   * @param idTenant - The ID of the tenant
   * @returns The latest location or null if no location is found
   */
  findByDevice(idDevice: string, idTenant: string) {
    return this.locationRepository.findLatestByDevice(idDevice, idTenant);
  }

  /**
   * Última ubicación por res (para mapa).
   * Incluye `cattle.number` para mostrarlo en UI.
   */
  async findLatestPerCattleForTenant(idTenant: string) {
    return this.locationRepository.findLatestPerCattleForTenant(idTenant);
  }

  /**
   * Find a location by ID
   * @param id - The ID of the location
   * @returns The location or null if no location is found
   */
  findOne(id: string) {
    return this.locationRepository.findOne({
      where: { id },
    });
  }

  /**
   * Remove a location by ID
   * @param id - The ID of the location
   * @returns The deleted location or null if no location is found
   */
  remove(id: string) {
    return this.locationRepository.delete(id);
  }
}