import React from "react";
import { BigCardsRow } from "./BigCardsRow";
import { KpiGrid } from "./KpiGrid";

export function StatsOverview({ data, derived }: { data: any, derived: any }) {
  return (
    <>
      <BigCardsRow data={data} derived={derived} />
      <KpiGrid 
        stats={data.stats} 
        velocity={data.velocity} 
        derived={derived} 
        currency={data.currency} 
      />
    </>
  );
}
