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

  /**
   * Retorna la última ubicación por res (para un tenant),
   * incluyendo el número de res desde `cattle.number`.
   *
   * Selecciona la ubicación con mayor `time` por cada `id_cattle`.
   */
  async findLatestPerCattleForTenant(
    idTenant: string,
  ): Promise<
    Array<{
      id: string;
      id_tenant: string;
      id_device: string;
      id_cattle: string;
      latitude: number;
      longitude: number;
      altitude: number | null;
      time: Date;
      cattle_number: string;
    }>
  > {
    const qb = this.createQueryBuilder('location');

    const latestSubQuery = qb
      .subQuery()
      .select('l.id_cattle', 'id_cattle')
      .addSelect('MAX(l.time)', 'max_time')
      .from(Location, 'l')
      .where('l.id_tenant = :idTenant', { idTenant })
      .groupBy('l.id_cattle')
      .getQuery();

    return this.createQueryBuilder('location')
      .innerJoin(
        `(${latestSubQuery})`,
        'latest',
        'latest.id_cattle = location.id_cattle AND latest.max_time = location.time',
      )
      .innerJoin('cattle', 'c', 'c.id = location.id_cattle AND c.id_tenant = location.id_tenant')
      .where('location.id_tenant = :idTenant', { idTenant })
      .select([
        'location.id AS id',
        'location.id_tenant AS id_tenant',
        'location.id_device AS id_device',
        'location.id_cattle AS id_cattle',
        'location.latitude AS latitude',
        'location.longitude AS longitude',
        'location.altitude AS altitude',
        'location.time AS time',
        'c.number AS cattle_number',
      ])
      .orderBy('c.number', 'ASC')
      .getRawMany();
  }

}
