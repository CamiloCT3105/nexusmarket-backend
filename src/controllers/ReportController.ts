import { Request, Response } from "express";
import { ReportService } from "../services/ReportService";

const DEFAULT_LOW_STOCK_THRESHOLD = 10;

// Convierte un parámetro de URL en fecha. Las fechas se interpretan en UTC.
// Si "to" viene solo como día (2026-10-08), incluye el día completo.
function parseDateParam(value: unknown, name: string, endOfDay: boolean): Date | undefined {
  if (value === undefined) return undefined;

  if (typeof value !== "string") {
    throw new Error(`El parámetro '${name}' debe ser una fecha.`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`El parámetro '${name}' no es una fecha válida (usa el formato AAAA-MM-DD).`);
  }

  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

export const ReportController = {
  summary(_req: Request, res: Response): void {
    try {
      res.status(200).json(ReportService.getSummary());
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  },

  sales(req: Request, res: Response): void {
    try {
      const from = parseDateParam(req.query.from, "from", false);
      const to = parseDateParam(req.query.to, "to", true);

      if (from && to && from > to) {
        res.status(400).json({ message: "La fecha 'from' no puede ser posterior a 'to'." });
        return;
      }

      res.status(200).json(ReportService.getSalesReport(from, to));
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  inventory(req: Request, res: Response): void {
    try {
      const rawThreshold = req.query.threshold;
      const threshold =
        rawThreshold === undefined ? DEFAULT_LOW_STOCK_THRESHOLD : Number(rawThreshold);

      if (!Number.isInteger(threshold) || threshold < 0) {
        res.status(400).json({ message: "El parámetro 'threshold' debe ser un entero mayor o igual a 0." });
        return;
      }

      res.status(200).json(ReportService.getInventoryReport(threshold));
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  },

  logistics(_req: Request, res: Response): void {
    try {
      res.status(200).json(ReportService.getLogisticsReport());
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  },

  returns(_req: Request, res: Response): void {
    try {
      res.status(200).json(ReportService.getReturnsReport());
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  },
};