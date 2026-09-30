/**
 * Typed façade over predefiend_routes.js — the raw JS module infers
 * string|number for object values, so every consumer goes through here.
 */

import {
  NODES as RawNodes,
  getEdge as rawGetEdge,
  legsBetween as rawLegsBetween,
  findRoutes as rawFindRoutes,
  shortestPath as rawShortestPath,
  priceLegs as rawPriceLegs,
  POOL_DISCOUNT_PCT as RawPoolDiscount,
  BASE_FARE_PAISA as rawBaseFare,
  formatTaka as rawFormatTaka,
} from "@/predefiend_routes";

export type GraphNode = {
  id: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  km: number;
  congestion: number;
  durationMin: number;
  pricePaisa: number;
};

export type GraphRoute = {
  id: string;
  code: string;
  name: string;
  corridor: string;
  stops: string[];
  legs: GraphEdge[];
  totalKm: number;
  totalMin: number;
  totalPricePaisa: number;
};

export type FareLine = {
  edgeId: string;
  from: string;
  to: string;
  riders: number;
  discountPct: number;
  pricePaisa: number;
  paidPaisa: number;
};

export type Fare = {
  baseFare: number;
  distanceCharge: number;
  poolDiscount: number;
  /** Extra discount from the Wait & Save promise; 0 when not used. */
  waitSaveDiscount: number;
  total: number;
  lines: FareLine[];
};

export const NODES = RawNodes as unknown as Record<string, GraphNode>;
export const BASE_FARE_PAISA = rawBaseFare as number;
export const POOL_DISCOUNT_PCT = RawPoolDiscount as unknown as Record<string, number>;
export const formatTaka = rawFormatTaka as (paisa: number) => string;
export const getEdge = rawGetEdge as (a: string, b: string) => GraphEdge | null;
export const legsBetween = rawLegsBetween as (
  routeId: string,
  from: string,
  to: string,
) => GraphEdge[] | null;
export const findRoutes = rawFindRoutes as (
  from: string,
  to: string,
) => GraphRoute[];
export const shortestPath = rawShortestPath as (
  from: string,
  to: string,
  weight?: "km" | "durationMin" | "pricePaisa",
) => { stops: string[]; legs: GraphEdge[]; total: number } | null;
export const priceLegs = rawPriceLegs as (
  legs: GraphEdge[],
  ridersPerLeg?: Record<string, number>,
) => Fare;
