import { BadRequestException, Injectable } from '@nestjs/common';
import { SAPA2014_RULES, DentitionRule } from '../constants/dentition-table-sapa2014';

export type DentitionInputs = {
  milkTeeth: number;
  permanentTeeth: number;
  milkWear: number;
  permanentWear: number;
};

@Injectable()
export class DentitionEstimationService {
  /**
   * Estima edad en días desde el nacimiento según tabla SAPA2014.
   * Primero intenta coincidencia exacta de intervalos; si no hay, usa score por distancia al centro de cada intervalo compatible en conteos.
   */
  estimateAgeDays(input: DentitionInputs): number {
    this.validateInputs(input);
    const exact = SAPA2014_RULES.filter(
      (r) =>
        r.milkTeeth === input.milkTeeth &&
        r.permanentTeeth === input.permanentTeeth &&
        input.milkWear >= r.milkWearMin &&
        input.milkWear <= r.milkWearMax &&
        input.permanentWear >= r.permWearMin &&
        input.permanentWear <= r.permWearMax,
    );
    if (exact.length === 1) {
      return exact[0].ageDays;
    }
    if (exact.length > 1) {
      return exact.reduce((a, b) => (a.ageDays <= b.ageDays ? a : b)).ageDays;
    }

    const sameCounts = SAPA2014_RULES.filter(
      (r) => r.milkTeeth === input.milkTeeth && r.permanentTeeth === input.permanentTeeth,
    );
    if (sameCounts.length === 0) {
      throw new BadRequestException('DENTITION_NO_RULE_FOR_COUNTS');
    }

    let best: { rule: DentitionRule; score: number } | null = null;
    for (const r of sameCounts) {
      const dm = this.distToInterval(input.milkWear, r.milkWearMin, r.milkWearMax);
      const dp = this.distToInterval(input.permanentWear, r.permWearMin, r.permWearMax);
      const score = dm * dm + dp * dp;
      if (!best || score < best.score) {
        best = { rule: r, score };
      }
    }
    return best!.rule.ageDays;
  }

  /** birthDate = evaluationDate − ageDays (solo fecha UTC). */
  computeBirthDateApprox(evaluationDate: Date, ageDays: number): Date {
    const d = new Date(Date.UTC(evaluationDate.getUTCFullYear(), evaluationDate.getUTCMonth(), evaluationDate.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - ageDays);
    return d;
  }

  private validateInputs(input: DentitionInputs): void {
    if (
      ![input.milkTeeth, input.permanentTeeth, input.milkWear, input.permanentWear].every(
        (n) => typeof n === 'number' && Number.isFinite(n),
      )
    ) {
      throw new BadRequestException('DENTITION_INVALID_NUMBERS');
    }
    if (input.milkWear < 0 || input.milkWear > 5 || input.permanentWear < 0 || input.permanentWear > 5) {
      throw new BadRequestException('DENTITION_WEAR_RANGE');
    }
    if (input.milkTeeth < 0 || input.milkTeeth > 8 || input.permanentTeeth < 0 || input.permanentTeeth > 8) {
      throw new BadRequestException('DENTITION_TEETH_RANGE');
    }
  }

  private distToInterval(v: number, lo: number, hi: number): number {
    if (v < lo) return lo - v;
    if (v > hi) return v - hi;
    return 0;
  }
}
