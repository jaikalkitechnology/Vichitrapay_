import React, { useState, useEffect, useCallback } from "react";
import api from "@/api/api";
import { BASE_URL } from "@/config";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type BankAccount = {
  id: number;
  user_id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name?: string;
  bank_branch?: string;
  account_type?: string;
  is_validate: boolean;
};

export default function BankApproval() {
  const { toast } = useToast();
  const [items, setItems] = useState<BankAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const fetchPending = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const r = await api.get(`${BASE_URL}/admin/bank-accounts/pending?page=${p}&per_page=20`);
      setItems(r.data.items || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchPending(page); }, [page]);

  const handleAction = async (id: number, action: "approve" | "reject") => {
    if (action === "reject" && !window.confirm("Reject and delete this bank account? This cannot be undone.")) return;
    setActionLoading((s) => ({ ...s, [id]: true }));
    try {
      await api.post(`${BASE_URL}/admin/bank-accounts/${id}/${action}`);
      toast({
        title: action === "approve" ? "Approved" : "Rejected",
        description: `Bank account ${id} ${action === "approve" ? "approved" : "rejected"} successfully.`,
      });
      fetchPending(page);
    } catch (err: any) {
      toast({ title: "Failed", description: err?.response?.data?.detail || "Action failed", variant: "destructive" });
    } finally {
      setActionLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          Bank Account Approval
        </h1>
        <p className="text-sm text-[var(--vp-text-secondary)] mt-2">Review and approve merchant bank accounts for payouts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-5 border-l-4 border-l-[#F68713]">
          <p className="text-sm text-[var(--vp-text-secondary)]">Pending Approvals</p>
          <p className="text-[22px] font-semibold text-[#F68713] mt-1">{total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-5 border-l-4 border-l-[#41B93D]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--vp-text-secondary)]">Action Required</p>
              <p className="text-sm text-[var(--vp-text-secondary)] mt-1">Approve or reject accounts below</p>
            </div>
            <Button variant="outline" onClick={() => fetchPending(page)} className="border-[#00ADEF] text-[#3871C2] rounded-lg h-9">Refresh</Button>
          </div>
        </div>
      </div>

      <Card className="border border-gray-100 dark:border-gray-700 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-gray-100 dark:border-gray-700 px-6 py-4">
          <CardTitle className="text-[22px] font-semibold" style={{ color: 'var(--vp-blue)' }}>Pending Bank Accounts</CardTitle>
          <CardDescription className="text-sm text-[var(--vp-text-secondary)]">Merchants waiting for bank account verification</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: "#3871C2" }}></div>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-lg font-medium">No pending bank accounts</p>
              <p className="text-sm mt-2">All accounts have been reviewed</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[var(--vp-surface-hover)]">
                    <TableRow>
                      <TableHead className="font-semibold text-gray-600 dark:text-gray-400">ID</TableHead>
                      <TableHead className="font-semibold text-gray-600 dark:text-gray-400">Merchant</TableHead>
                      <TableHead className="font-semibold text-gray-600 dark:text-gray-400">Account Holder</TableHead>
                      <TableHead className="font-semibold text-gray-600 dark:text-gray-400">Account No</TableHead>
                      <TableHead className="font-semibold text-gray-600 dark:text-gray-400">IFSC</TableHead>
                      <TableHead className="font-semibold text-gray-600 dark:text-gray-400">Bank</TableHead>
                      <TableHead className="font-semibold text-gray-600 dark:text-gray-400">Branch</TableHead>
                      <TableHead className="font-semibold text-gray-600 dark:text-gray-400">Type</TableHead>
                      <TableHead className="font-semibold text-gray-600 dark:text-gray-400 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((a) => (
                      <TableRow key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <TableCell className="font-mono text-sm">{a.id}</TableCell>
                        <TableCell className="font-mono text-sm">{a.user_id}</TableCell>
                        <TableCell className="font-medium">{a.account_holder_name}</TableCell>
                        <TableCell className="font-mono text-sm">{a.account_number}</TableCell>
                        <TableCell className="font-mono text-sm">{a.ifsc_code}</TableCell>
                        <TableCell>{a.bank_name || "-"}</TableCell>
                        <TableCell>{a.bank_branch || "-"}</TableCell>
                        <TableCell>{a.account_type || "-"}</TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-2">
                            <Button size="sm" onClick={() => handleAction(a.id, "approve")} disabled={actionLoading[a.id]}
                              className="bg-[#41B93D] hover:bg-green-600 text-white rounded-lg h-9">
                              {actionLoading[a.id] ? "..." : "Approve"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleAction(a.id, "reject")} disabled={actionLoading[a.id]}
                              className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg h-9">
                              {actionLoading[a.id] ? "..." : "Reject"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between p-4 border-t">
                <span className="text-sm text-gray-600">Page {page} of {totalPages} — {total} accounts</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
