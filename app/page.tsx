import Dashboard from "./dashboard";
import { mostSoldProduct, repeatVsNewCustomerSales, returnsOnlineVsOffline, topProductCategory, totalSalesForBlackItems } from "@/lib/metrics";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export default function Page() {
  const juneProduct = mostSoldProduct("2025-06-01", "2025-06-30")!;
  const juneReturns = returnsOnlineVsOffline("2025-06-01", "2025-06-30");
  const customerSales = repeatVsNewCustomerSales("2025-06-01", "2025-06-30");
  const julyCategory = topProductCategory("2025-07-01", "2025-07-31")!;
  return <Dashboard metrics={[
    { label: "Most sold product · June", value: juneProduct.product, sub: `${juneProduct.units} units` },
    { label: "Returns · June", value: `${juneReturns.online} / ${juneReturns.offline}`, sub: "Online / Offline units" },
    { label: "Customer sales · June", value: `${money(customerSales.repeatSales)} / ${money(customerSales.newSales)}`, sub: "Repeat / New" },
    { label: "Black items · 10 Sep", value: money(totalSalesForBlackItems("2025-09-10", "2025-09-10")), sub: "Sales on 10/9/2025 (DD/MM)" },
    { label: "Top category · July", value: julyCategory.category, sub: `${julyCategory.units} units` }
  ]} />;
}
