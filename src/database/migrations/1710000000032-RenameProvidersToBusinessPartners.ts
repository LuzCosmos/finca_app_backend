import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renombra catálogo de terceros: providers → business_partners.
 * En purchases y cattle se mantiene la columna id_provider (rol proveedor en compra).
 */
export class RenameProvidersToBusinessPartners1710000000032 implements MigrationInterface {
  name = 'RenameProvidersToBusinessPartners1710000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "fk_purchase_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cattle" DROP CONSTRAINT IF EXISTS "fk_cattle_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "FK_fb465726b1745ecff7eea073e0e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "FK_1dce894d11886cb53ef56f43e7c"`,
    );
    await queryRunner.query(`ALTER TABLE "providers" RENAME TO "business_partners"`);
    await queryRunner.query(
      `ALTER TYPE "public"."providers_type_enum" RENAME TO "business_partner_roles_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_partners" RENAME CONSTRAINT "pk_provider_id" TO "pk_business_partner_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_partners" RENAME CONSTRAINT "uq_provider_tenant_nit" TO "uq_business_partner_tenant_nit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_partners" RENAME CONSTRAINT "FK_providers_contact_person" TO "FK_business_partners_contact_person"`,
    );

    await queryRunner.query(`
      ALTER TABLE "purchases"
      ADD CONSTRAINT "fk_purchase_provider"
      FOREIGN KEY ("id_provider") REFERENCES "business_partners"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle"
      ADD CONSTRAINT "fk_cattle_provider"
      FOREIGN KEY ("id_provider") REFERENCES "business_partners"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD CONSTRAINT "FK_sales_buyer_business_partner"
      FOREIGN KEY ("buyer_id") REFERENCES "business_partners"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD CONSTRAINT "FK_sales_transporter_business_partner"
      FOREIGN KEY ("transporter_id") REFERENCES "business_partners"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    const commerceRows = await queryRunner.query(
      `SELECT access_details FROM modules WHERE code = 'COMMERCE'`,
    );
    if (commerceRows?.length > 0) {
      let details = commerceRows[0].access_details;
      if (typeof details === 'string') {
        details = JSON.parse(details);
      }
      if (details.providers) {
        details.business_partners = details.providers;
        delete details.providers;
        await queryRunner.query(
          `UPDATE modules SET access_details = '${JSON.stringify(details)}' WHERE code = 'COMMERCE'`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const commerceRows = await queryRunner.query(
      `SELECT access_details FROM modules WHERE code = 'COMMERCE'`,
    );
    if (commerceRows?.length > 0) {
      let details = commerceRows[0].access_details;
      if (typeof details === 'string') {
        details = JSON.parse(details);
      }
      if (details.business_partners) {
        details.providers = details.business_partners;
        delete details.business_partners;
        await queryRunner.query(
          `UPDATE modules SET access_details = '${JSON.stringify(details)}' WHERE code = 'COMMERCE'`,
        );
      }
    }

    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "FK_sales_transporter_business_partner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "FK_sales_buyer_business_partner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cattle" DROP CONSTRAINT IF EXISTS "fk_cattle_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "fk_purchase_provider"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_partners" RENAME CONSTRAINT "FK_business_partners_contact_person" TO "FK_providers_contact_person"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_partners" RENAME CONSTRAINT "uq_business_partner_tenant_nit" TO "uq_provider_tenant_nit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_partners" RENAME CONSTRAINT "pk_business_partner_id" TO "pk_provider_id"`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."business_partner_roles_enum" RENAME TO "providers_type_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "business_partners" RENAME TO "providers"`);

    await queryRunner.query(`
      ALTER TABLE "providers"
      ADD CONSTRAINT "FK_providers_contact_person"
      FOREIGN KEY ("contact_person_id") REFERENCES "contacts"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD CONSTRAINT "FK_fb465726b1745ecff7eea073e0e"
      FOREIGN KEY ("buyer_id") REFERENCES "providers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD CONSTRAINT "FK_1dce894d11886cb53ef56f43e7c"
      FOREIGN KEY ("transporter_id") REFERENCES "providers"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "cattle"
      ADD CONSTRAINT "fk_cattle_provider"
      FOREIGN KEY ("id_provider") REFERENCES "providers"("id")
      ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "purchases"
      ADD CONSTRAINT "fk_purchase_provider"
      FOREIGN KEY ("id_provider") REFERENCES "providers"("id")
      ON DELETE SET NULL
    `);
  }
}
