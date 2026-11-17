import { Request, Response } from "express";
import { ReportService } from "../services/ReportService";
import { ValidationError } from "../errors/AppError";

const DEFAULT_LOW_STOCK_THRESHOLD = 10;

// Convierte un parámetro de URL en fecha. Las fechas se interpretan en UTC.
// Si "to" viene solo como día (2026-10-08), incluye el día completo.
function parseDateParam(value: unknown, name: string, endOfDay: boolean): Date | undefined {
  if (value === undefined) return undefined;

  if (typeof value !== "string") {
    throw new ValidationError(`El parámetro '${name}' debe ser una fecha.`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(
      `El parámetro '${name}' no es una fecha válida (usa el formato AAAA-MM-DD).`
    );
  }

  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

export const ReportController = {
  async summary(_req: Request, res: Response): Promise<void> {
    res.status(200).json(await ReportService.getSummary());
  },

  async sales(req: Request, res: Response): Promise<void> {
    const from = parseDateParam(req.query.from, "from", false);
    const to = parseDateParam(req.query.to, "to", true);

    if (from && to && from > to) {
      throw new ValidationError("La fecha 'from' no puede ser posterior a 'to'.");
    }

    res.status(200).json(await ReportService.getSalesReport(from, to));
  },

  async inventory(req: Request, res: Response): Promise<void> {
    const rawThreshold = req.query.threshold;
    const threshold =
      rawThreshold === undefined ? DEFAULT_LOW_STOCK_THRESHOLD : Number(rawThreshold);

    if (!Number.isInteger(threshold) || threshold < 0) {
      throw new ValidationError("El parámetro 'threshold' debe ser un entero mayor o igual a 0.");
    }

    res.status(200).json(await ReportService.getInventoryReport(threshold));
  },

  async logistics(_req: Request, res: Response): Promise<void> {
    res.status(200).json(await ReportService.getLogisticsReport());
  },

  async returns(_req: Request, res: Response): Promise<void> {
    res.status(200).json(await ReportService.getReturnsReport());
  },
};
