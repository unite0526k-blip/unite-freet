
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Driver = {
  id?: number | string;
  name: string;
  office?: string;
};

type Statement = {
  id: string;
  driver_name: string;
  target_month: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type CompanyStatement = {
  id: string;
  company_id: string;
  target_month: string;
  is_published: boolean;
};

type Company = {
  id: string;
  company_name: string;
  representative_driver_name: string;
};

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${year}年${Number(month)}月`;
}

export default function PaymentPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activeTab, setActiveTab] = useState<"driver" | "company">("driver");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyPdfId, setCompanyPdfId] = useState("");
  const [companyPdfMonth, setCompanyPdfMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [companyPdfFile, setCompanyPdfFile] = useState<File | null>(null);
  const [companyPdfUploading, setCompanyPdfUploading] = useState(false);
  const [companyPdfMessage, setCompanyPdfMessage] = useState("");
  const [companyPdfError, setCompanyPdfError] = useState(false);
  const [companyStatements, setCompanyStatements] = useState<CompanyStatement[]>([]);
  const [companyStatementsLoading, setCompanyStatementsLoading] = useState(true);
  const [companyChangingId, setCompanyChangingId] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyMonthFilter, setCompanyMonthFilter] = useState("all");
  const [companyStatusFilter, setCompanyStatusFilter] = useState("all");
  const [companyPage, setCompanyPage] = useState(1);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [companyBulkUpdating, setCompanyBulkUpdating] = useState(false);
  const [companyDeletingId, setCompanyDeletingId] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyMessage, setCompanyMessage] = useState("");
  const [companyError, setCompanyError] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [targetMonth, setTargetMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
  });

  const [file, setFile] = useState<File | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [changingId, setChangingId] = useState<string | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedStatementIds, setSelectedStatementIds] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const normalizeName = (name: string) => name.replace(/[\s　]+/g, "").trim();
  const months = useMemo(() => Array.from(new Set(statements.map(s => s.target_month))).sort().reverse(), [statements]);
  const filteredStatements = useMemo(() => statements.filter(s => {
    return (monthFilter === "all" || s.target_month === monthFilter) &&
      (statusFilter === "all" || (statusFilter === "published" ? s.is_published : !s.is_published)) &&
      normalizeName(s.driver_name).includes(normalizeName(nameFilter));
  }).sort((a,b) => b.target_month.localeCompare(a.target_month) || a.driver_name.localeCompare(b.driver_name,"ja")), [statements, statusFilter, monthFilter, nameFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredStatements.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleStatements = filteredStatements.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filteredIds = filteredStatements.map((s) => s.id);
  const selectedVisibleCount = filteredIds.filter((id) => selectedStatementIds.includes(id)).length;
  const allFilteredSelected = filteredIds.length > 0 && selectedVisibleCount === filteredIds.length;
  const selectedCount = selectedStatementIds.length;

  const companyMonths = useMemo(() => [...new Set(companyStatements.map(s => s.target_month))].sort().reverse(), [companyStatements]);
  const filteredCompanyStatements = useMemo(() => companyStatements.filter(s => {
    const company = companies.find(c => c.id === s.company_id);
    return (companyMonthFilter === "all" || s.target_month === companyMonthFilter) &&
      (companyStatusFilter === "all" || (companyStatusFilter === "published" ? s.is_published : !s.is_published)) &&
      normalizeName(company?.company_name ?? "").includes(normalizeName(companySearch));
  }).sort((a, b) => b.target_month.localeCompare(a.target_month) ||
    (companies.find(c => c.id === a.company_id)?.company_name ?? "").localeCompare(companies.find(c => c.id === b.company_id)?.company_name ?? "", "ja")),
    [companyStatements, companies, companyMonthFilter, companyStatusFilter, companySearch]);
  const companyFilteredIds = filteredCompanyStatements.map(s => s.id);
  const allCompaniesSelected = companyFilteredIds.length > 0 && companyFilteredIds.every(id => selectedCompanyIds.includes(id));
  const companyTotalPages = Math.max(1, Math.ceil(filteredCompanyStatements.length / PAGE_SIZE));
  const companyCurrentPage = Math.min(companyPage, companyTotalPages);
  const visibleCompanyStatements = filteredCompanyStatements.slice((companyCurrentPage - 1) * PAGE_SIZE, companyCurrentPage * PAGE_SIZE);



  const getToken = useCallback(async () => {
    if (!supabase) {
      throw new Error("Supabaseに接続できません。");
    }

    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    const token = data.session?.access_token;

    if (!token) {
      throw new Error(
        "ログインの有効期限が切れています。再ログインしてください。"
      );
    }

    return token;
  }, []);

  const loadStatements = useCallback(async () => {
    setLoadingList(true);

    try {
      const token = await getToken();

      const response = await fetch("/api/payment/statements", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "登録済みPDFの取得に失敗しました。"
        );
      }

      setStatements(
        Array.isArray(result.statements)
          ? result.statements
          : []
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "一覧の取得に失敗しました。"
      );
      setIsError(true);
    } finally {
      setLoadingList(false);
    }
  }, [getToken]);

  const loadCompanies = useCallback(async () => {
    setCompanyLoading(true);
    try {
      const token = await getToken();
      const response = await fetch("/api/payment/companies", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "協力会社の取得に失敗しました。");
      setCompanies(Array.isArray(result.companies) ? result.companies : []);
    } catch (error) {
      setCompanyError(true);
      setCompanyMessage(error instanceof Error ? error.message : "協力会社を取得できませんでした。");
    } finally {
      setCompanyLoading(false);
    }
  }, [getToken]);

  const loadCompanyStatements = useCallback(async () => {
    setCompanyStatementsLoading(true);
    try {
      const token = await getToken();
      const response = await fetch("/api/payment/company-statements", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "会社明細の取得に失敗しました。");
      setCompanyStatements(Array.isArray(result.statements) ? result.statements : []);
    } catch (error) {
      setCompanyPdfError(true);
      setCompanyPdfMessage(error instanceof Error ? error.message : "会社明細の取得に失敗しました。");
    } finally {
      setCompanyStatementsLoading(false);
    }
  }, [getToken]);

  async function uploadCompanyPdf() {
    setCompanyPdfMessage("");
    setCompanyPdfError(false);
    if (!companyPdfId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(companyPdfMonth) || !companyPdfFile) {
      setCompanyPdfError(true);
      setCompanyPdfMessage("協力会社・対象年月・PDFを確認してください。");
      return;
    }
    if (companyPdfFile.size === 0 || companyPdfFile.size > 10 * 1024 * 1024 ||
        (companyPdfFile.type !== "application/pdf" && !companyPdfFile.name.toLowerCase().endsWith(".pdf"))) {
      setCompanyPdfError(true);
      setCompanyPdfMessage("10MB以下のPDFを選択してください。");
      return;
    }
    setCompanyPdfUploading(true);
    try {
      const token = await getToken();
      const form = new FormData();
      form.append("companyId", companyPdfId);
      form.append("targetMonth", companyPdfMonth);
      form.append("file", companyPdfFile);
      const response = await fetch("/api/payment/company-upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "会社PDFの登録に失敗しました。");
      setCompanyPdfFile(null);
      const input = document.getElementById("company-payment-pdf") as HTMLInputElement | null;
      if (input) input.value = "";
      setCompanyPdfMessage("会社PDFを非公開で登録しました。");
      await loadCompanyStatements();
    } catch (error) {
      setCompanyPdfError(true);
      setCompanyPdfMessage(error instanceof Error ? error.message : "会社PDFの登録に失敗しました。");
    } finally {
      setCompanyPdfUploading(false);
    }
  }

  async function toggleCompanyPublished(statement: CompanyStatement) {
    const nextPublished = !statement.is_published;
    const company = companies.find((item) => item.id === statement.company_id);
    if (nextPublished && !window.confirm(`${company?.company_name ?? "協力会社"}の${monthLabel(statement.target_month)}の明細を公開しますか？`)) return;
    setCompanyChangingId(statement.id);
    setCompanyPdfMessage("");
    setCompanyPdfError(false);
    try {
      const token = await getToken();
      const response = await fetch("/api/payment/company-statements", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: statement.id, isPublished: nextPublished }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "公開状態を変更できませんでした。");
      setCompanyStatements((previous) => previous.map((item) => item.id === statement.id ? { ...item, is_published: nextPublished } : item));
      setCompanyPdfMessage(nextPublished ? "公開に変更しました。" : "非公開に変更しました。");
    } catch (error) {
      setCompanyPdfError(true);
      setCompanyPdfMessage(error instanceof Error ? error.message : "公開状態を変更できませんでした。");
    } finally {
      setCompanyChangingId(null);
    }
  }

  function prepareCompanyReplacement(statement: CompanyStatement) {
    const company = companies.find(c => c.id === statement.company_id);
    setCompanyPdfId(statement.company_id);
    setCompanyPdfMonth(statement.target_month);
    setCompanyPdfFile(null);
    const input = document.getElementById("company-payment-pdf") as HTMLInputElement | null;
    if (input) input.value = "";
    setCompanyPdfError(false);
    setCompanyPdfMessage(`${company?.company_name ?? "協力会社"}・${monthLabel(statement.target_month)}の差し替えです。PDFを選択して登録してください。登録後は非公開になります。`);
    document.getElementById("company-payment-upload")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function bulkSetCompanyPublished(nextPublished: boolean) {
    const selected = companyStatements.filter(s => selectedCompanyIds.includes(s.id));
    const targets = selected.filter(s => s.is_published !== nextPublished);
    if (!selected.length) { setCompanyPdfError(true); setCompanyPdfMessage("明細を選択してください。"); return; }
    if (!targets.length) { setCompanyPdfError(false); setCompanyPdfMessage("選択した明細はすでに変更後の状態です。"); return; }
    if (!window.confirm(`選択した${selected.length}件のうち${targets.length}件を${nextPublished ? "公開" : "非公開"}にしますか？`)) return;
    setCompanyBulkUpdating(true);
    setCompanyPdfMessage("");
    setCompanyPdfError(false);
    let completed = 0;
    try {
      const token = await getToken();
      for (const statement of targets) {
        const response = await fetch("/api/payment/company-statements", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ id: statement.id, isPublished: nextPublished }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || "公開状態の変更に失敗しました。");
        completed++;
      }
      setSelectedCompanyIds([]);
      setCompanyPdfMessage(`${completed}件を${nextPublished ? "公開" : "非公開"}に変更しました。`);
    } catch (error) {
      setCompanyPdfError(true);
      setCompanyPdfMessage(`${completed}件変更後に停止しました。${error instanceof Error ? error.message : "処理に失敗しました。"}`);
    } finally {
      await loadCompanyStatements();
      setCompanyBulkUpdating(false);
    }
  }

  async function deleteCompanyStatement(statement: CompanyStatement) {
    const company = companies.find(c => c.id === statement.company_id);
    if (!window.confirm(`${company?.company_name ?? "協力会社"}・${monthLabel(statement.target_month)}の明細を削除しますか？\n削除後は元に戻せません。`)) return;
    setCompanyDeletingId(statement.id);
    setCompanyPdfError(false);
    setCompanyPdfMessage("");
    try {
      const token = await getToken();
      const response = await fetch("/api/payment/company-statements", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: statement.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || "削除APIが未対応の可能性があります。");
      setSelectedCompanyIds(ids => ids.filter(id => id !== statement.id));
      setCompanyPdfMessage("協力会社の明細を削除しました。");
      await loadCompanyStatements();
    } catch (error) {
      setCompanyPdfError(true);
      setCompanyPdfMessage(error instanceof Error ? error.message : "削除に失敗しました。");
    } finally {
      setCompanyDeletingId(null);
    }
  }

  async function registerCompany() {
    if (!companyName.trim() || !representativeName) return;
    setCompanySaving(true);
    setCompanyMessage("");
    try {
      const token = await getToken();
      const response = await fetch("/api/payment/companies", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          representativeDriverName: representativeName,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "協力会社の登録に失敗しました。");
      }
      setCompanyName("");
      setRepresentativeName("");
      setCompanyError(false);
      setCompanyMessage("協力会社を登録しました。");
      await loadCompanies();
    } catch (error) {
      setCompanyError(true);
      setCompanyMessage(error instanceof Error ? error.message : "協力会社の登録に失敗しました。");
    } finally {
      setCompanySaving(false);
    }
  }

  async function changeRepresentative(company: Company, nextName: string) {
    if (!nextName || nextName === company.representative_driver_name) return;
    if (!window.confirm(`${company.company_name}の代表者を${nextName}に変更しますか？`)) return;
    setCompanySaving(true);
    setCompanyMessage("");
    try {
      const token = await getToken();
      const response = await fetch("/api/payment/companies", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: company.id, representativeDriverName: nextName }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "代表者の変更に失敗しました。");
      }
      setCompanyError(false);
      setCompanyMessage("代表者を変更しました。");
      await loadCompanies();
    } catch (error) {
      setCompanyError(true);
      setCompanyMessage(error instanceof Error ? error.message : "代表者の変更に失敗しました。");
    } finally {
      setCompanySaving(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      try {
        if (!supabase) {
          throw new Error("Supabaseに接続できません。");
        }

        await getToken();

        const { data, error } = await supabase
          .from("fleet_master")
          .select("drivers")
          .eq("id", "default")
          .single();

        if (error) throw error;

        const list: Driver[] = Array.isArray(data?.drivers)
          ? data.drivers.filter(
              (item: unknown): item is Driver =>
                typeof item === "object" &&
                item !== null &&
                "name" in item &&
                typeof item.name === "string"
            )
          : [];

        const unique = Array.from(
          new Map(list.map((d) => [d.name, d])).values()
        );

        unique.sort((a, b) =>
          a.name.localeCompare(b.name, "ja")
        );

        setDrivers(unique);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "ドライバー一覧を取得できませんでした。"
        );
        setIsError(true);
      } finally {
        setLoadingDrivers(false);
      }
    }

    void initialize();
    void loadStatements();
    void loadCompanies();
    void loadCompanyStatements();
  }, [getToken, loadStatements, loadCompanies, loadCompanyStatements]);

  async function uploadPdf() {
    setMessage("");
    setIsError(false);

    if (!driverName) {
      setMessage("ドライバーを選択してください。");
      setIsError(true);
      return;
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      setMessage("対象年月を確認してください。");
      setIsError(true);
      return;
    }

    if (!file) {
      setMessage("PDFを選択してください。");
      setIsError(true);
      return;
    }

    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setMessage("10MB以下のPDFを選択してください。");
      setIsError(true);
      return;
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setMessage("PDFファイルを選択してください。");
      setIsError(true);
      return;
    }

    // 同じドライバー・同じ対象年月の明細がある場合だけ、差し替え確認を表示する。
    const existingStatement = statements.find(
      (statement) =>
        normalizeName(statement.driver_name) === normalizeName(driverName) &&
        statement.target_month === targetMonth
    );

    if (existingStatement) {
      const confirmed = window.confirm(
        `⚠️ すでに登録されています！\n\n` +
          `ドライバー：${driverName}\n` +
          `対象年月：${monthLabel(targetMonth)}\n` +
          `公開状態：${existingStatement.is_published ? "公開中" : "非公開"}\n\n` +
          `登録済みのPDFを差し替えますか？\n` +
          `※差し替え後は非公開に戻ります。`
      );
      if (!confirmed) return;
    }

    setLoading(true);

    try {
      const token = await getToken();

      const formData = new FormData();
      formData.append("driverName", driverName);
      formData.append("targetMonth", targetMonth);
      formData.append("file", file);

      const response = await fetch("/api/payment/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "PDFの登録に失敗しました。"
        );
      }

      setMessage(
        result.message ||
          "PDFを非公開で登録しました。"
      );
      setIsError(false);
      setFile(null);

      const input = document.getElementById(
        "payment-pdf-file"
      ) as HTMLInputElement | null;

      if (input) input.value = "";

      await loadStatements();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "PDFの登録に失敗しました。"
      );
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }

  function prepareReplacement(statement: Statement) {
    setDriverName(statement.driver_name);
    setTargetMonth(statement.target_month);
    setFile(null);
    const input = document.getElementById("payment-pdf-file") as HTMLInputElement | null;
    if (input) input.value = "";
    setMessage(`${statement.driver_name}・${monthLabel(statement.target_month)}の差し替えです。正しいPDFを選択して登録してください。登録後は非公開になります。`);
    setIsError(false);
    document.getElementById("driver-payment-upload")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteStatement(statement: Statement) {
    if (!window.confirm(`${statement.driver_name}・${monthLabel(statement.target_month)}の支払明細を削除しますか？\n削除後は元に戻せません。`)) return;
    setDeletingId(statement.id);
    setMessage("");
    setIsError(false);
    try {
      const token = await getToken();
      const response = await fetch("/api/payment/statements", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: statement.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || "削除できませんでした。サーバー側の削除機能を確認してください。");
      }
      setMessage("支払明細を削除しました。");
      await loadStatements();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "削除に失敗しました。");
    } finally {
      setDeletingId(null);
    }
  }

  async function bulkSetPublished(nextPublished: boolean) {
    const selected = statements.filter((s) => selectedStatementIds.includes(s.id));
    const targets = selected.filter((s) => s.is_published !== nextPublished);
    if (selected.length === 0) {
      setIsError(true);
      setMessage("明細を選択してください。");
      return;
    }
    if (targets.length === 0) {
      setIsError(false);
      setMessage(nextPublished ? "選択した明細はすべて公開済みです。" : "選択した明細はすべて非公開です。");
      return;
    }
    if (!window.confirm(`選択した${selected.length}件のうち${targets.length}件を${nextPublished ? "公開" : "非公開"}にしますか？`)) return;
    setBulkUpdating(true);
    setMessage("");
    setIsError(false);
    try {
      const token = await getToken();
      const response = await fetch("/api/payment/statements", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: targets.map((s) => s.id), isPublished: nextPublished }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || "一括変更に失敗しました。");
      setSelectedStatementIds([]);
      setMessage(`${result.updatedCount ?? targets.length}件を${nextPublished ? "公開" : "非公開"}に変更しました。`);
      await loadStatements();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "一括変更に失敗しました。");
      await loadStatements();
    } finally {
      setBulkUpdating(false);
    }
  }

  async function togglePublished(statement: Statement) {
    const nextPublished = !statement.is_published;

    if (
      nextPublished &&
      !window.confirm(
        `${statement.driver_name}の${monthLabel(
          statement.target_month
        )}の明細を公開しますか？`
      )
    ) {
      return;
    }

    setChangingId(statement.id);
    setMessage("");
    setIsError(false);

    try {
      const token = await getToken();

      const response = await fetch(
        "/api/payment/statements",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: statement.id,
            isPublished: nextPublished,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "公開設定の変更に失敗しました。"
        );
      }

      setStatements((previous) =>
        previous.map((item) =>
          item.id === statement.id
            ? { ...item, is_published: nextPublished }
            : item
        )
      );

      setMessage(
        nextPublished
          ? "公開設定に変更しました。"
          : "非公開に変更しました。"
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "公開設定の変更に失敗しました。"
      );
      setIsError(true);
    } finally {
      setChangingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-2xl bg-blue-950 p-6 text-white">
          <h1 className="text-2xl font-bold">
            UNITE Fleet
          </h1>
          <p className="mt-1 text-blue-200">
            支払明細管理
          </p>
        </header>

        <nav className="flex gap-2 rounded-2xl bg-white p-2 shadow-sm" aria-label="支払明細の種類">
          <button type="button" onClick={() => setActiveTab("driver")}
            className={`flex-1 rounded-xl p-3 font-bold ${activeTab === "driver" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`}>
            個人ドライバー
          </button>
          <button type="button" onClick={() => setActiveTab("company")}
            className={`flex-1 rounded-xl p-3 font-bold ${activeTab === "company" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`}>
            協力会社
          </button>
        </nav>

        {activeTab === "driver" ? (
          <>
        <section id="driver-payment-upload" className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">
            支払明細PDFの登録
          </h2>

          <label
            htmlFor="payment-driver"
            className="mb-2 block font-semibold"
          >
            ドライバー名
          </label>

          <select
            id="payment-driver"
            value={driverName}
            onChange={(event) =>
              setDriverName(event.target.value)
            }
            disabled={loading || loadingDrivers}
            className="mb-5 w-full rounded-xl border border-slate-300 bg-white p-3"
          >
            <option value="">
              {loadingDrivers
                ? "読み込み中..."
                : "ドライバーを選択"}
            </option>

            {drivers.map((driver) => (
              <option
                key={`${driver.id ?? ""}-${driver.name}`}
                value={driver.name}
              >
                {driver.office
                  ? `${driver.name}（${driver.office}）`
                  : driver.name}
              </option>
            ))}
          </select>

          <label
            htmlFor="payment-month"
            className="mb-2 block font-semibold"
          >
            対象年月
          </label>

          <input
            id="payment-month"
            type="month"
            value={targetMonth}
            onChange={(event) =>
              setTargetMonth(event.target.value)
            }
            disabled={loading}
            className="mb-5 w-full rounded-xl border border-slate-300 p-3"
          />

          <label
            htmlFor="payment-pdf-file"
            className="mb-2 block font-semibold"
          >
            PDFファイル
          </label>

          <input
            id="payment-pdf-file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) =>
              setFile(event.target.files?.[0] ?? null)
            }
            disabled={loading}
            className="mb-5 w-full rounded-xl border border-slate-300 p-3"
          />

          <button
            type="button"
            onClick={() => void uploadPdf()}
            disabled={
              loading ||
              loadingDrivers ||
              !driverName ||
              !targetMonth ||
              !file
            }
            className="w-full rounded-xl bg-blue-600 p-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "PDFを登録しています..."
              : "PDFを登録する"}
          </button>

          <p className="mt-3 text-sm text-slate-500">
            {file
              ? `選択中：${file.name}`
              : "PDFを選択してください。"}
          </p>

          {message && (
            <div
              role="status"
              className={`mt-4 rounded-xl p-4 text-sm ${
                isError
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-800"
              }`}
            >
              {message}
            </div>
          )}

          <p className="mt-4 text-sm text-amber-700">
            PDFは非公開で登録されます。
            同じドライバー・対象年月で再登録すると、
            以前のPDFが置き換わり非公開に戻ります。
          </p>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              登録済み支払明細
            </h2>

            <button
              type="button"
              onClick={() => void loadStatements()}
              disabled={loadingList}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              一覧を更新
            </button>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-semibold">対象年月
              <select value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5">
                <option value="all">すべての年月</option>
                {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">ドライバー名
              <input type="search" value={nameFilter} onChange={e => { setNameFilter(e.target.value); setPage(1); }} placeholder="名前で検索" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
            </label>
            <label className="block text-sm font-semibold">公開状態
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5">
                <option value="all">すべて</option>
                <option value="published">公開中</option>
                <option value="unpublished">非公開</option>
              </select>
            </label>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>検索結果：{filteredStatements.length}件（全{statements.length}件）</span>
            <button type="button" className="rounded-lg border px-3 py-1.5" onClick={() => { setStatusFilter("all"); setMonthFilter("all"); setNameFilter(""); setPage(1); }}>絞り込み解除</button>
          </div>
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={bulkUpdating || filteredIds.length === 0} onClick={() => setSelectedStatementIds((previous) => {
                const otherIds = previous.filter((id) => !filteredIds.includes(id));
                return allFilteredSelected ? otherIds : [...new Set([...previous, ...filteredIds])];
              })} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">
                {allFilteredSelected ? "一括選択を解除" : `一括選択（${filteredIds.length}件）`}
              </button>
              <span className="text-sm font-semibold text-blue-950">選択中：{selectedCount}件</span>
              <button type="button" onClick={() => setSelectedStatementIds([])} disabled={bulkUpdating || selectedCount === 0} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50">選択解除</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void bulkSetPublished(true)} disabled={bulkUpdating || changingId !== null || deletingId !== null || selectedCount === 0} className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-50">{bulkUpdating ? "変更中..." : "選択した明細を一括公開"}</button>
              <button type="button" onClick={() => void bulkSetPublished(false)} disabled={bulkUpdating || changingId !== null || deletingId !== null || selectedCount === 0} className="rounded-lg bg-slate-700 px-4 py-2 font-bold text-white disabled:opacity-50">{bulkUpdating ? "変更中..." : "選択した明細を一括非公開"}</button>
            </div>
            <p className="mt-2 text-xs text-slate-600">「一括選択」は、検索・年月などで絞り込んだ全件（ページをまたぐ分も含む）が対象です。絞り込みなしなら登録済み全件を選択します。</p>
          </div>
          {loadingList ? (
            <p className="text-slate-500">読み込み中...</p>
          ) : statements.length === 0 ? (
            <p className="text-slate-500">登録済みのPDFはありません。</p>
          ) : filteredStatements.length === 0 ? (
            <p className="text-slate-500">条件に合う支払明細はありません。</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[540px] text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700"><tr>
                    <th className="p-3">選択</th><th className="p-3">ドライバー</th><th className="p-3">対象年月</th><th className="p-3">公開状態</th><th className="p-3">操作</th>
                  </tr></thead>
                  <tbody>
                    {visibleStatements.map(statement => (
                      <tr key={statement.id} className="border-t border-slate-200">
                        <td className="p-3"><input type="checkbox" aria-label={`${statement.driver_name} ${monthLabel(statement.target_month)}を選択`} checked={selectedStatementIds.includes(statement.id)} disabled={bulkUpdating} onChange={(event) => setSelectedStatementIds((previous) => event.target.checked ? [...new Set([...previous, statement.id])] : previous.filter((id) => id !== statement.id))} className="h-5 w-5 accent-blue-700" /></td>
                        <td className="p-3 font-semibold">{statement.driver_name}</td>
                        <td className="whitespace-nowrap p-3">{monthLabel(statement.target_month)}</td>
                        <td className={`whitespace-nowrap p-3 font-semibold ${statement.is_published ? "text-green-700" : "text-amber-700"}`}>{statement.is_published ? "● 公開中" : "● 非公開"}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => void togglePublished(statement)} disabled={bulkUpdating || changingId === statement.id || deletingId === statement.id} className={`whitespace-nowrap rounded-lg px-3 py-2 font-bold text-white disabled:opacity-50 ${statement.is_published ? "bg-slate-600" : "bg-blue-600"}`}>
                              {changingId === statement.id ? "変更中..." : statement.is_published ? "非公開にする" : "公開する"}
                            </button>
                            <button type="button" onClick={() => prepareReplacement(statement)} disabled={bulkUpdating || loading || deletingId === statement.id} className="whitespace-nowrap rounded-lg border border-blue-600 px-3 py-2 font-bold text-blue-700 disabled:opacity-50">PDF差し替え</button>
                            <button type="button" onClick={() => void deleteStatement(statement)} disabled={bulkUpdating || deletingId === statement.id || changingId === statement.id} className="whitespace-nowrap rounded-lg border border-red-300 px-3 py-2 font-bold text-red-700 disabled:opacity-50">{deletingId === statement.id ? "削除中..." : "削除"}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && <div className="mt-4 flex items-center justify-center gap-4">
                <button type="button" disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1,p-1))} className="rounded-lg border px-4 py-2 disabled:opacity-40">前へ</button>
                <span className="text-sm">{currentPage} / {totalPages} ページ</span>
                <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages,p+1))} className="rounded-lg border px-4 py-2 disabled:opacity-40">次へ</button>
              </div>}
            </>
          )}
        </section>
          </>
        ) : (
          <>
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-xl font-bold">協力会社の登録</h2>
              <label htmlFor="company-name" className="mb-2 block font-semibold">協力会社名</label>
              <input id="company-name" value={companyName}
                onChange={(e) => setCompanyName(e.target.value)} maxLength={100}
                placeholder="例：株式会社ABC"
                className="mb-5 w-full rounded-xl border border-slate-300 p-3" />
              <label htmlFor="company-representative" className="mb-2 block font-semibold">代表者（登録済みドライバー）</label>
              <select id="company-representative" value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                disabled={loadingDrivers}
                className="mb-5 w-full rounded-xl border border-slate-300 bg-white p-3">
                <option value="">代表者を選択</option>
                {drivers.map((driver) => (
                  <option key={`${driver.id ?? ""}-${driver.name}`} value={driver.name}>
                    {driver.office ? `${driver.name}（${driver.office}）` : driver.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => void registerCompany()}
                disabled={companySaving || !companyName.trim() || !representativeName}
                className="w-full rounded-xl bg-blue-600 p-4 font-bold text-white disabled:opacity-50">
                {companySaving ? "登録中..." : "協力会社を登録する"}
              </button>
              {companyMessage && (
                <p role="status" className={`mt-4 rounded-xl p-4 text-sm ${companyError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>
                  {companyMessage}
                </p>
              )}
              <p className="mt-4 text-sm text-slate-500">代表者は登録済みのPINで会社明細を閲覧できます。</p>
            </section>
            <section id="company-payment-upload" className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-xl font-bold">協力会社の支払明細PDF登録</h2>
              <label htmlFor="company-payment-company" className="mb-2 block font-semibold">協力会社</label>
              <select id="company-payment-company" value={companyPdfId} onChange={(e) => setCompanyPdfId(e.target.value)}
                disabled={companyPdfUploading || companyLoading}
                className="mb-5 w-full rounded-xl border border-slate-300 bg-white p-3">
                <option value="">協力会社を選択</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.company_name}</option>)}
              </select>
              <label htmlFor="company-payment-month" className="mb-2 block font-semibold">対象年月</label>
              <input id="company-payment-month" type="month" value={companyPdfMonth} onChange={(e) => setCompanyPdfMonth(e.target.value)}
                disabled={companyPdfUploading} className="mb-5 w-full rounded-xl border border-slate-300 p-3" />
              <label htmlFor="company-payment-pdf" className="mb-2 block font-semibold">PDFファイル</label>
              <input id="company-payment-pdf" type="file" accept="application/pdf,.pdf"
                onChange={(e) => setCompanyPdfFile(e.target.files?.[0] ?? null)} disabled={companyPdfUploading}
                className="mb-5 w-full rounded-xl border border-slate-300 p-3" />
              <button type="button" onClick={() => void uploadCompanyPdf()}
                disabled={companyPdfUploading || !companyPdfId || !companyPdfMonth || !companyPdfFile}
                className="w-full rounded-xl bg-blue-600 p-4 font-bold text-white disabled:opacity-50">
                {companyPdfUploading ? "PDFを登録しています..." : "協力会社のPDFを登録する"}
              </button>
              {companyPdfMessage && <p role="status" className={`mt-4 rounded-xl p-4 text-sm ${companyPdfError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{companyPdfMessage}</p>}
              <p className="mt-4 text-sm text-amber-700">登録直後は非公開です。同じ会社・同じ月の再登録では古いPDFを置き換え、非公開に戻します。</p>
            </section>
            <section className="rounded-2xl bg-white p-6 shadow-sm">
               <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                 <h2 className="text-xl font-bold">登録済み協力会社明細</h2>
                 <button type="button" onClick={() => void loadCompanyStatements()} disabled={companyStatementsLoading}
                   className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">一覧を更新</button>
               </div>
               <div className="mb-4 grid gap-3 sm:grid-cols-3">
                 <label className="block text-sm font-semibold">対象年月
                   <select value={companyMonthFilter} onChange={e => { setCompanyMonthFilter(e.target.value); setCompanyPage(1); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5">
                     <option value="all">すべての年月</option>
                     {companyMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                   </select>
                 </label>
                 <label className="block text-sm font-semibold">協力会社名
                   <input type="search" value={companySearch} onChange={e => { setCompanySearch(e.target.value); setCompanyPage(1); }} placeholder="会社名で検索" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                 </label>
                 <label className="block text-sm font-semibold">公開状態
                   <select value={companyStatusFilter} onChange={e => { setCompanyStatusFilter(e.target.value); setCompanyPage(1); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5">
                     <option value="all">すべて</option><option value="published">公開中</option><option value="unpublished">非公開</option>
                   </select>
                 </label>
               </div>
               <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                 <span>検索結果：{filteredCompanyStatements.length}件（全{companyStatements.length}件）</span>
                 <button type="button" className="rounded-lg border px-3 py-1.5" onClick={() => { setCompanyMonthFilter("all"); setCompanySearch(""); setCompanyStatusFilter("all"); setCompanyPage(1); }}>絞り込み解除</button>
               </div>
               <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                 <div className="flex flex-wrap items-center gap-3">
                   <button type="button" disabled={companyBulkUpdating || companyFilteredIds.length === 0} onClick={() => setSelectedCompanyIds(previous => {
                     const other = previous.filter(id => !companyFilteredIds.includes(id));
                     return allCompaniesSelected ? other : [...new Set([...previous, ...companyFilteredIds])];
                   })} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">
                     {allCompaniesSelected ? "一括選択を解除" : `一括選択（${companyFilteredIds.length}件）`}
                   </button>
                   <span className="text-sm font-semibold text-blue-950">選択中：{selectedCompanyIds.length}件</span>
                   <button type="button" onClick={() => setSelectedCompanyIds([])} disabled={companyBulkUpdating || selectedCompanyIds.length === 0} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50">選択解除</button>
                 </div>
                 <div className="mt-3 flex flex-wrap gap-2">
                   <button type="button" onClick={() => void bulkSetCompanyPublished(true)} disabled={companyBulkUpdating || companyChangingId !== null || companyDeletingId !== null || selectedCompanyIds.length === 0} className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-50">{companyBulkUpdating ? "変更中..." : "選択した明細を一括公開"}</button>
                   <button type="button" onClick={() => void bulkSetCompanyPublished(false)} disabled={companyBulkUpdating || companyChangingId !== null || companyDeletingId !== null || selectedCompanyIds.length === 0} className="rounded-lg bg-slate-700 px-4 py-2 font-bold text-white disabled:opacity-50">{companyBulkUpdating ? "変更中..." : "選択した明細を一括非公開"}</button>
                 </div>
                 <p className="mt-2 text-xs text-slate-600">一括選択は絞り込んだ全件（ページをまたぐ分も含む）が対象です。</p>
               </div>
               {companyStatementsLoading ? <p className="text-slate-500">読み込み中...</p> : companyStatements.length === 0 ?
                 <p className="text-slate-500">登録済みの会社PDFはありません。</p> : filteredCompanyStatements.length === 0 ?
                 <p className="text-slate-500">条件に合う協力会社明細はありません。</p> : <>
                 <div className="overflow-x-auto rounded-xl border border-slate-200">
                   <table className="w-full min-w-[640px] text-left text-sm">
                     <thead className="bg-slate-100"><tr><th className="p-3">選択</th><th className="p-3">協力会社</th><th className="p-3">対象年月</th><th className="p-3">公開状態</th><th className="p-3">操作</th></tr></thead>
                     <tbody>{visibleCompanyStatements.map(statement => (
                       <tr key={statement.id} className="border-t border-slate-200">
                         <td className="p-3"><input type="checkbox" aria-label={`${companies.find(c => c.id === statement.company_id)?.company_name ?? "協力会社"} ${monthLabel(statement.target_month)}を選択`} checked={selectedCompanyIds.includes(statement.id)} disabled={companyBulkUpdating} onChange={e => setSelectedCompanyIds(previous => e.target.checked ? [...new Set([...previous, statement.id])] : previous.filter(id => id !== statement.id))} className="h-5 w-5 accent-blue-700" /></td>
                         <td className="p-3 font-semibold">{companies.find(c => c.id === statement.company_id)?.company_name ?? "登録会社不明"}</td>
                         <td className="whitespace-nowrap p-3">{monthLabel(statement.target_month)}</td>
                         <td className={`whitespace-nowrap p-3 font-semibold ${statement.is_published ? "text-green-700" : "text-amber-700"}`}>{statement.is_published ? "● 公開中" : "● 非公開"}</td>
                         <td className="p-3"><div className="flex flex-wrap gap-2">
                           <button type="button" onClick={() => void toggleCompanyPublished(statement)} disabled={companyBulkUpdating || companyChangingId === statement.id || companyDeletingId === statement.id} className={`whitespace-nowrap rounded-lg px-3 py-2 font-bold text-white disabled:opacity-50 ${statement.is_published ? "bg-slate-600" : "bg-blue-600"}`}>{companyChangingId === statement.id ? "変更中..." : statement.is_published ? "非公開にする" : "公開する"}</button>
                           <button type="button" onClick={() => prepareCompanyReplacement(statement)} disabled={companyBulkUpdating || companyPdfUploading || companyDeletingId === statement.id} className="whitespace-nowrap rounded-lg border border-blue-600 px-3 py-2 font-bold text-blue-700 disabled:opacity-50">PDF差し替え</button>
                           <button type="button" onClick={() => void deleteCompanyStatement(statement)} disabled={companyBulkUpdating || companyDeletingId === statement.id || companyChangingId === statement.id} className="whitespace-nowrap rounded-lg border border-red-300 px-3 py-2 font-bold text-red-700 disabled:opacity-50">{companyDeletingId === statement.id ? "削除中..." : "削除"}</button>
                         </div></td>
                       </tr>
                     ))}</tbody>
                   </table>
                 </div>
                 {companyTotalPages > 1 && <div className="mt-4 flex items-center justify-center gap-4">
                   <button type="button" disabled={companyCurrentPage === 1} onClick={() => setCompanyPage(p => Math.max(1, p - 1))} className="rounded-lg border px-4 py-2 disabled:opacity-40">前へ</button>
                   <span className="text-sm">{companyCurrentPage} / {companyTotalPages} ページ</span>
                   <button type="button" disabled={companyCurrentPage === companyTotalPages} onClick={() => setCompanyPage(p => Math.min(companyTotalPages, p + 1))} className="rounded-lg border px-4 py-2 disabled:opacity-40">次へ</button>
                 </div>}
               </>}
             </section>
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold">登録済み協力会社</h2>
                <button type="button" onClick={() => void loadCompanies()} disabled={companyLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">一覧を更新</button>
              </div>
              {companyLoading ? (
                <p className="text-slate-500">読み込み中...</p>
              ) : companies.length === 0 ? (
                <p className="text-slate-500">登録済みの協力会社はありません。</p>
              ) : (
                <div className="space-y-3">
                  {companies.map((company) => (
                    <div key={company.id} className="rounded-xl border border-slate-200 p-4">
                      <p className="mb-3 font-bold">{company.company_name}</p>
                      <label className="block text-sm font-semibold">
                        代表者（変更すると新しい代表者が閲覧対象になります）
                        <select value={company.representative_driver_name}
                          onChange={(e) => void changeRepresentative(company, e.target.value)}
                          disabled={companySaving || loadingDrivers}
                          className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3">
                          {!drivers.some((d) => d.name === company.representative_driver_name) && (
                            <option value={company.representative_driver_name}>{company.representative_driver_name}（現在の登録）</option>
                          )}
                          {drivers.map((driver) => (
                            <option key={`${driver.id ?? ""}-${driver.name}`} value={driver.name}>
                              {driver.office ? `${driver.name}（${driver.office}）` : driver.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
