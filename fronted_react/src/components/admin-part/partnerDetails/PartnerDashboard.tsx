// Partner panel (/partner/*): Merchants, Merchant Transactions, Profile & Settings
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { isPanelTab, type PanelTab } from "@/components/admin-part/partnerDetails/partnerTabs";
import PanelMerchants from "@/components/admin-part/partnerDetails/PanelMerchants";
import PanelTransactions from "@/components/admin-part/partnerDetails/PanelTransactions";
import PanelProfile from "@/components/admin-part/partnerDetails/PanelProfile";

const tabFromPath = (pathname: string): PanelTab => {
  const seg = pathname.replace(/^\/partner\/?/, "").split("/")[0];
  return isPanelTab(seg) ? seg : "merchants";
};

export default function PartnerDashboard() {
  const location = useLocation();
  const [tab, setTab] = useState<PanelTab>(() => tabFromPath(location.pathname));
  useEffect(() => setTab(tabFromPath(location.pathname)), [location.pathname]);

  return (
    <DashboardLayout activeTab={tab} onTabChange={(t) => isPanelTab(t) && setTab(t)}>
      {tab === "merchants" && <PanelMerchants />}
      {tab === "transactions" && <PanelTransactions />}
      {tab === "profile" && <PanelProfile />}
    </DashboardLayout>
  );
}
