import { Repository } from 'typeorm';
import { Location } from '../entities/location.entity';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateLocationDto } from '../dto/create-location.dto';

@Injectable()
export class LocationRepository extends Repository<Location> {

  constructor(private dataSource: DataSource) {
    super(Location, dataSource.createEntityManager());
  }

  /**
   * Find the latest location by device ID
   * @param deviceId - The ID of the device
   * @returns The latest location or null if no location is found
   */
  async findLatestByDevice(deviceId: string, idTenant: string): Promise<Location | null> {
    return this.createQueryBuilder('location')
      .where('location.id_device = :deviceId', { deviceId })
      .andWhere('location.id_tenant = :idTenant', { idTenant })
      .orderBy('location.created_at', 'DESC')
      .getOne();
  }

  /**
   * Find the latest location by cattle ID
   * @param cattleId - The ID of the cattle
   * @returns The latest location or null if no location is found
   */
  async findLatestByCattle(cattleId: string, idTenant: string): Promise<Location | null> {
    return this.createQueryBuilder('location')
      .where('location.id_cattle = :cattleId', { cattleId })
      .andWhere('location.id_tenant = :idTenant', { idTenant })
      .orderBy('location.created_at', 'DESC')
      .getOne();
  }

  /**
   * Create a new location
   * @param locationDto - The location data
   * @returns The created location
   */
  async createLocation(locationDto: CreateLocationDto) {
    const location = this.create(locationDto);
    return this.save(location);
  }


}
