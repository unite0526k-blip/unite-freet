"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

type Office = string;
type ViewOffice = string;
type TransactionType = "入金" | "出金";
type ViewMode = "month" | "year";

type Transaction = {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  transferFee?: number;
  leaseRevenue?: number;
  isVehicleExpense?: boolean;
  vehicleExpenseAmount?: number;
  partner: string;
  office: Office;
  category: string;
  description: string;
  note: string;
  createdAt: string;
};

type OpeningCashData = Record<string, number>;


type VehicleStatus =
  | "貸出中"
  | "代車貸出中"
  | "保管中"
  | "廃車";

type Vehicle = {
  id: number;
  office: string;
  number: string;
  driver: string;
  status: VehicleStatus;
  leaseStartDate?: string;
  monthlyLeaseFee?: number;
  leaseFeeOverrides?: Record<string, number>;
};


type FinanceBackup = {
  app: "UNITE Fleet";
  type: "finance-backup";
  version: number;
  createdAt: string;
  transactions: Transaction[];
  openingCash: OpeningCashData;
};

const STORAGE_KEY =
  "unite-fleet-finance-transactions";

const OPENING_CASH_KEY =
  "unite-fleet-finance-opening-cash";

const VEHICLE_STORAGE_KEY =
  "unite-fleet-vehicles";

const DEFAULT_LEASE_FEE = 33000;

const FINANCE_OFFICES_KEY = "unite-fleet-finance-offices";

const DEFAULT_FINANCE_OFFICES: Office[] = [
  "松阪営業所",
  "伊勢営業所",
  "鈴鹿営業所",
  "伊賀営業所",
  "浜松営業所",
  "京都営業所",
  "全社共通",
];

const incomeCategories = [
  "売上入金",
  "車両リース入金",
  "立替金返金",
  "その他入金",
];

const expenseCategories = [
  "ドライバー外注費",
  "給与",
  "ガソリン代",
  "車両費",
  "車両リース",
  "自動車保険",
  "家賃",
  "高速代",
  "駐車場代",
  "通信費",
  "システム費",
  "広告費",
  "キックバック",
  "税金",
  "返済",
  "その他出金",
];

const yen = (value: number) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);

function currentMonth() {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
}

function today() {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function FinancePage() {
  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [vehicles, setVehicles] =
    useState<Vehicle[]>([]);

  const [loaded, setLoaded] = useState(false);

  const [financeOffices, setFinanceOffices] =
    useState<Office[]>(DEFAULT_FINANCE_OFFICES);

  const [showOfficeSettings, setShowOfficeSettings] =
    useState(false);

  const [newOfficeName, setNewOfficeName] =
    useState("");

  const [editingOffice, setEditingOffice] =
    useState<string | null>(null);

  const [editingOfficeName, setEditingOfficeName] =
    useState("");

  const [draggedOffice, setDraggedOffice] =
    useState<string | null>(null);

  const [dragOverOffice, setDragOverOffice] =
    useState<string | null>(null);

  const [office, setOffice] =
    useState<ViewOffice>("全社");

  const [month, setMonth] =
    useState(currentMonth());

  const [viewMode, setViewMode] =
    useState<ViewMode>("month");

  const [year, setYear] = useState(
    String(new Date().getFullYear())
  );

  const [openingCash, setOpeningCash] =
    useState(0);

  const [
    openingCashInput,
    setOpeningCashInput,
  ] = useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [showVehicleExpenseForm, setShowVehicleExpenseForm] =
    useState(false);
  const [editingVehicleExpenseId, setEditingVehicleExpenseId] =
    useState<string | null>(null);
  const [vehicleExpenseDate, setVehicleExpenseDate] =
    useState("");
  const [vehicleExpenseValue, setVehicleExpenseValue] =
    useState("");
  const [vehicleExpenseDescription, setVehicleExpenseDescription] =
    useState("");
  const [vehicleExpenseNote, setVehicleExpenseNote] =
    useState("");

  const [editingTransactionId, setEditingTransactionId] =
    useState<string | null>(null);

  const [type, setType] =
    useState<TransactionType>("入金");

  const [date, setDate] = useState(today());

  const [amount, setAmount] =
    useState("");

  const [hasTransferFee, setHasTransferFee] =
    useState(false);

  const [transferFee, setTransferFee] =
    useState("");

  const [hasLeaseRevenue, setHasLeaseRevenue] = useState(false);
  const [leaseRevenueInput, setLeaseRevenueInput] = useState("33000");
  const [isVehicleExpense, setIsVehicleExpense] = useState(false);
  const [vehicleExpenseAmount, setVehicleExpenseAmount] = useState("");

  const [partner, setPartner] =
    useState("");

  const [formOffice, setFormOffice] =
    useState<Office>("松阪営業所");

  const [category, setCategory] =
    useState("売上入金");

  const [description, setDescription] =
    useState("");

  const [note, setNote] =
    useState("");

  // ============================
  // 入出金明細 検索・絞り込み
  // ============================

  const [searchPartner, setSearchPartner] =
    useState("");
  const [searchDescription, setSearchDescription] =
    useState("");
  const [filterType, setFilterType] =
    useState<"すべて" | TransactionType>("すべて");
  const [filterTransferFee, setFilterTransferFee] =
    useState<"すべて" | "あり" | "なし">("すべて");
  const [filterLeaseRevenue, setFilterLeaseRevenue] =
    useState<"すべて" | "あり" | "なし">("すべて");
  const [filterVehicleExpense, setFilterVehicleExpense] =
    useState<"すべて" | "あり" | "なし">("すべて");

  // ============================
  // 初回データ読み込み
  // ============================

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setTransactions(parsed);
        }
      }

      const savedOpeningCash =
        localStorage.getItem(
          OPENING_CASH_KEY
        );

      if (savedOpeningCash) {
        const parsed =
          JSON.parse(savedOpeningCash);

        const value =
          Number(parsed[month] || 0);

        setOpeningCash(value);

        setOpeningCashInput(
          value ? String(value) : ""
        );
      }

      const savedFinanceOffices =
        localStorage.getItem(
          FINANCE_OFFICES_KEY
        );

      if (savedFinanceOffices) {
        const parsedOffices =
          JSON.parse(savedFinanceOffices);

        if (
          Array.isArray(parsedOffices) &&
          parsedOffices.length > 0
        ) {
          const normalizedOffices = parsedOffices.map(
            (item: string) =>
              item === "全営業所共通営業所"
                ? "全社共通"
                : item
          );

          const uniqueOffices = Array.from(
            new Set(normalizedOffices)
          ) as string[];

          const normalOffices = uniqueOffices.filter(
            (item) => item !== "全社共通"
          );

          setFinanceOffices([
            ...normalOffices,
            "全社共通",
          ]);
        }
      } else {
        localStorage.setItem(
          FINANCE_OFFICES_KEY,
          JSON.stringify(DEFAULT_FINANCE_OFFICES)
        );
      }

      const savedVehicles =
        localStorage.getItem(
          VEHICLE_STORAGE_KEY
        );

      if (savedVehicles) {
        const parsedVehicles =
          JSON.parse(savedVehicles);

        if (Array.isArray(parsedVehicles)) {
          setVehicles(parsedVehicles);
        }
      }
    } catch (error) {
      console.error(
        "資金データの読み込みに失敗しました",
        error
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  // ============================
  // 入出金を自動保存
  // ============================

  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(transactions)
    );
  }, [transactions, loaded]);

  // ============================
  // 月変更時の月初現金
  // ============================

  useEffect(() => {
    try {
      const savedOpeningCash =
        localStorage.getItem(
          OPENING_CASH_KEY
        );

      const parsed = savedOpeningCash
        ? JSON.parse(savedOpeningCash)
        : {};

      const value =
        Number(parsed[month] || 0);

      setOpeningCash(value);

      setOpeningCashInput(
        value ? String(value) : ""
      );
    } catch {
      setOpeningCash(0);
      setOpeningCashInput("");
    }
  }, [month]);

  // ============================
  // 資金管理専用 営業所管理
  // ============================

  const viewOffices: ViewOffice[] = useMemo(
    () => ["全社", ...financeOffices],
    [financeOffices]
  );

  function persistFinanceOffices(next: Office[]) {
    setFinanceOffices(next);
    localStorage.setItem(
      FINANCE_OFFICES_KEY,
      JSON.stringify(next)
    );
  }

  function addFinanceOffice() {
    let name = newOfficeName.trim();
    if (!name) {
      alert("営業所名を入力してください");
      return;
    }

    if (name === "全社") {
      alert("「全社」は営業所名として使用できません");
      return;
    }

    if (!name.endsWith("営業所") && name !== "全社共通") {
      name = `${name}営業所`;
    }

    if (financeOffices.includes(name)) {
      alert("同じ営業所がすでに登録されています");
      return;
    }

    persistFinanceOffices([...financeOffices, name]);
    setNewOfficeName("");
  }

  function startEditFinanceOffice(name: string) {
    setEditingOffice(name);
    setEditingOfficeName(name);
  }

  function saveFinanceOfficeName() {
    if (!editingOffice) return;

    let nextName = editingOfficeName.trim();
    if (!nextName) {
      alert("営業所名を入力してください");
      return;
    }

    if (nextName === "全社") {
      alert("「全社」は営業所名として使用できません");
      return;
    }

    if (
      !nextName.endsWith("営業所") &&
      nextName !== "全社共通"
    ) {
      nextName = `${nextName}営業所`;
    }

    if (
      financeOffices.some(
        (item) =>
          item !== editingOffice &&
          item === nextName
      )
    ) {
      alert("同じ営業所がすでに登録されています");
      return;
    }

    // 過去の入出金も新しい営業所名へ引き継ぐ
    const nextTransactions = transactions.map((item) =>
      item.office === editingOffice
        ? { ...item, office: nextName }
        : item
    );

    setTransactions(nextTransactions);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nextTransactions)
    );

    const nextOffices = financeOffices.map((item) =>
      item === editingOffice ? nextName : item
    );

    persistFinanceOffices(nextOffices);

    if (office === editingOffice) {
      setOffice(nextName);
    }

    if (formOffice === editingOffice) {
      setFormOffice(nextName);
    }

    setEditingOffice(null);
    setEditingOfficeName("");
  }

  function moveFinanceOffice(
    sourceName: string,
    targetName: string
  ) {
    if (
      sourceName === targetName ||
      sourceName === "全社共通" ||
      targetName === "全社共通"
    ) {
      return;
    }

    const movable = financeOffices.filter(
      (item) => item !== "全社共通"
    );

    const fromIndex = movable.indexOf(sourceName);
    const toIndex = movable.indexOf(targetName);

    if (fromIndex < 0 || toIndex < 0) return;

    const nextMovable = [...movable];
    const [moved] = nextMovable.splice(fromIndex, 1);
    nextMovable.splice(toIndex, 0, moved);

    persistFinanceOffices([
      ...nextMovable,
      "全社共通",
    ]);
  }

  function handleOfficeDragStart(
    event: React.DragEvent<HTMLDivElement>,
    name: string
  ) {
    if (name === "全社共通") {
      event.preventDefault();
      return;
    }

    setDraggedOffice(name);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", name);
  }

  function handleOfficeDragOver(
    event: React.DragEvent<HTMLDivElement>,
    name: string
  ) {
    if (
      !draggedOffice ||
      name === "全社共通"
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverOffice(name);
  }

  function handleOfficeDrop(
    event: React.DragEvent<HTMLDivElement>,
    targetName: string
  ) {
    event.preventDefault();

    const sourceName =
      draggedOffice ||
      event.dataTransfer.getData("text/plain");

    if (sourceName) {
      moveFinanceOffice(sourceName, targetName);
    }

    setDraggedOffice(null);
    setDragOverOffice(null);
  }

  function handleOfficeDragEnd() {
    setDraggedOffice(null);
    setDragOverOffice(null);
  }

  function deleteFinanceOffice(name: string) {
    if (name === "全社共通") {
      alert("「全社共通」は削除できません");
      return;
    }

    const usedCount = transactions.filter(
      (item) => item.office === name
    ).length;

    if (usedCount > 0) {
      alert(
        `${name}には入出金データが${usedCount}件あります。\n` +
        "過去データを守るため削除できません。\n" +
        "営業所名の変更は「編集」を使ってください。"
      );
      return;
    }

    const ok = window.confirm(
      `${name}を資金管理から削除しますか？`
    );
    if (!ok) return;

    const nextOffices = financeOffices.filter(
      (item) => item !== name
    );

    persistFinanceOffices(nextOffices);

    if (office === name) {
      setOffice("全社");
    }

    if (formOffice === name) {
      setFormOffice(
        nextOffices.find(
          (item) => item !== "全社共通"
        ) || "全社共通"
      );
    }
  }

  // ============================
  // 表示中の入出金
  // ============================

  const monthTransactions =
    useMemo(() => {
      return transactions.filter(
        (item) => {
          const sameMonth =
            item.date.startsWith(month);

          return sameMonth;
        }
      );
    }, [transactions, month, office]);

  const filteredMonthTransactions = useMemo(
    () =>
      monthTransactions.filter((item) => {
        const partnerMatch =
          !searchPartner.trim() ||
          item.partner
            .toLowerCase()
            .includes(searchPartner.trim().toLowerCase());

        const descriptionMatch =
          !searchDescription.trim() ||
          (item.description || "")
            .toLowerCase()
            .includes(searchDescription.trim().toLowerCase());

        const typeMatch =
          filterType === "すべて" ||
          item.type === filterType;

        const hasFee =
          item.type === "出金" &&
          (item.transferFee || 0) > 0;
        const transferFeeMatch =
          filterTransferFee === "すべて" ||
          (filterTransferFee === "あり"
            ? hasFee
            : !hasFee);

        const hasLease =
          item.type === "出金" &&
          (item.leaseRevenue || 0) > 0;
        const leaseRevenueMatch =
          filterLeaseRevenue === "すべて" ||
          (filterLeaseRevenue === "あり"
            ? hasLease
            : !hasLease);

        const hasVehicleExpense =
          item.type === "出金" &&
          item.isVehicleExpense === true;
        const vehicleExpenseMatch =
          filterVehicleExpense === "すべて" ||
          (filterVehicleExpense === "あり"
            ? hasVehicleExpense
            : !hasVehicleExpense);

        return (
          partnerMatch &&
          descriptionMatch &&
          typeMatch &&
          transferFeeMatch &&
          leaseRevenueMatch &&
          vehicleExpenseMatch
        );
      }),
    [
      monthTransactions,
      searchPartner,
      searchDescription,
      filterType,
      filterTransferFee,
      filterLeaseRevenue,
      filterVehicleExpense,
    ]
  );

  function resetDetailFilters() {
    setSearchPartner("");
    setSearchDescription("");
    setFilterType("すべて");
    setFilterTransferFee("すべて");
    setFilterLeaseRevenue("すべて");
    setFilterVehicleExpense("すべて");
  }

  const filteredIncomeTotal = useMemo(
    () => filteredMonthTransactions.filter((item) => item.type === "入金")
      .reduce((sum, item) => sum + item.amount, 0),
    [filteredMonthTransactions]
  );

  const filteredExpenseTotal = useMemo(
    () => filteredMonthTransactions.filter((item) => item.type === "出金")
      .reduce((sum, item) => sum + item.amount, 0),
    [filteredMonthTransactions]
  );

  const filteredNetTotal = filteredIncomeTotal - filteredExpenseTotal;

  const filteredTransferFeeTotal = useMemo(
    () => filteredMonthTransactions.reduce(
      (sum, item) => sum + (item.transferFee || 0), 0
    ),
    [filteredMonthTransactions]
  );

  const filteredLeaseRevenueTotal = useMemo(
    () => filteredMonthTransactions.reduce(
      (sum, item) => sum + (item.leaseRevenue || 0), 0
    ),
    [filteredMonthTransactions]
  );

  const filteredVehicleExpenseTotal = useMemo(
    () => filteredMonthTransactions
      .filter((item) => item.isVehicleExpense === true)
      .reduce((sum, item) => sum + (item.vehicleExpenseAmount || item.amount || 0), 0),
    [filteredMonthTransactions]
  );

  // ============================
  // 表示中の入金
  // ============================

  const income = useMemo(
    () =>
      monthTransactions
        .filter(
          (item) =>
            item.type === "入金"
        )
        .reduce(
          (sum, item) =>
            sum + item.amount,
          0
        ),
    [monthTransactions]
  );

  // ============================
  // 表示中の出金
  // ============================

  const expense = useMemo(
    () =>
      monthTransactions
        .filter(
          (item) =>
            item.type === "出金"
        )
        .reduce(
          (sum, item) =>
            sum + item.amount,
          0
        ),
    [monthTransactions]
  );

  const balance = income - expense;

  // ============================
  // 月次 粗利
  // 売上 = 「売上入金」
  // 原価 = 「ドライバー外注費」
  // ============================

  const sales = useMemo(
    () =>
      monthTransactions
        .filter(
          (item) =>
            item.type === "入金" &&
            item.category === "売上入金"
        )
        .reduce((sum, item) => sum + item.amount, 0),
    [monthTransactions]
  );

  const costOfSales = useMemo(
    () =>
      monthTransactions
        .filter(
          (item) =>
            item.type === "出金" &&
            item.category === "ドライバー外注費"
        )
        .reduce((sum, item) => sum + item.amount, 0),
    [monthTransactions]
  );

  const leaseSalesForGross = useMemo(
    () =>
      monthTransactions
        .filter((item) => item.type === "出金")
        .reduce(
          (sum, item) =>
            sum + (item.leaseRevenue || 0),
          0
        ),
    [monthTransactions]
  );

  const salesWithLease =
    sales + leaseSalesForGross;

  const costOfSalesWithLease =
    costOfSales + leaseSalesForGross;

  const grossProfit =
    salesWithLease - costOfSalesWithLease;

  const grossProfitRate =
    salesWithLease > 0
      ? (grossProfit / salesWithLease) * 100
      : 0;

  // ============================
  // 経費負担率（費目別）
  // ============================

  const monthlyExpenseBurdenRows = useMemo(
    () =>
      expenseCategories
        .map((expenseCategory) => {
          const amount = monthTransactions
            .filter(
              (item) =>
                item.type === "出金" &&
                item.category === expenseCategory
            )
            .reduce(
              (sum, item) => sum + item.amount,
              0
            );

          return {
            category: expenseCategory,
            amount,
            rate:
              salesWithLease > 0
                ? (amount / salesWithLease) * 100
                : 0,
          };
        })
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    [monthTransactions, salesWithLease]
  );

  const yearExpenseBurdenRows = useMemo(() => {
    const yearList = transactions.filter((item) =>
      item.date.startsWith(`${year}-`)
    );

    const baseSales = yearList
      .filter(
        (item) =>
          item.type === "入金" &&
          item.category === "売上入金"
      )
      .reduce((sum, item) => sum + item.amount, 0);

    const leaseSales = yearList
      .filter((item) => item.type === "出金")
      .reduce(
        (sum, item) =>
          sum + (item.leaseRevenue || 0),
        0
      );

    const totalSales = baseSales + leaseSales;

    return expenseCategories
      .map((expenseCategory) => {
        const amount = yearList
          .filter(
            (item) =>
              item.type === "出金" &&
              item.category === expenseCategory
          )
          .reduce(
            (sum, item) => sum + item.amount,
            0
          );

        return {
          category: expenseCategory,
          amount,
          rate:
            totalSales > 0
              ? (amount / totalSales) * 100
              : 0,
        };
      })
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, year]);

  // ============================
  // 車両収支
  // ============================

  const monthlyLeaseRevenue = useMemo(
    () =>
      monthTransactions
        .filter((item) => item.type === "出金")
        .reduce(
          (sum, item) =>
            sum + (item.leaseRevenue || 0),
          0
        ),
    [monthTransactions]
  );

  const monthlyVehicleExpense = useMemo(
    () =>
      monthTransactions
        .filter(
          (item) =>
            item.type === "出金" &&
            item.isVehicleExpense === true
        )
        .reduce(
          (sum, item) =>
            sum + (item.vehicleExpenseAmount || 0),
          0
        ),
    [monthTransactions]
  );

  const monthlyVehicleProfit =
    monthlyLeaseRevenue -
    monthlyVehicleExpense;

  // ============================
  // 営業利益
  // 粗利 − 車両経費 − その他営業経費
  // ※ドライバー外注費は原価ですでに差し引いているため除外
  // ============================

  const otherOperatingExpenses = useMemo(
    () =>
      monthTransactions
        .filter(
          (item) =>
            item.type === "出金" &&
            item.category !== "ドライバー外注費" &&
            item.isVehicleExpense !== true
        )
        .reduce(
          (sum, item) => sum + item.amount,
          0
        ),
    [monthTransactions]
  );

  const operatingProfit =
    grossProfit -
    monthlyVehicleExpense -
    otherOperatingExpenses;

  const operatingProfitRate =
    sales > 0
      ? (operatingProfit / sales) * 100
      : 0;

  // ============================
  // 全社の当月データ
  // ============================

  const allCompanyMonthTransactions =
    useMemo(
      () =>
        transactions.filter(
          (item) =>
            item.date.startsWith(month)
        ),
      [transactions, month]
    );

  const companyIncome =
    allCompanyMonthTransactions
      .filter(
        (item) => item.type === "入金"
      )
      .reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );

  const companyExpense =
    allCompanyMonthTransactions
      .filter(
        (item) => item.type === "出金"
      )
      .reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );

  const currentCash =
    openingCash +
    companyIncome -
    companyExpense;

  // ============================
  // 営業所別損益
  // ============================

  const officeSummary = useMemo(() => {
    return financeOffices
      .filter(
        (item) =>
          item !== "全社共通"
      )
      .map((item) => {
        const list =
          transactions.filter(
            (transaction) =>
              transaction.date.startsWith(
                month
              ) &&
              transaction.office === item
          );

        const officeIncome = list
          .filter(
            (transaction) =>
              transaction.type === "入金"
          )
          .reduce(
            (sum, transaction) =>
              sum +
              transaction.amount,
            0
          );

        const officeExpense = list
          .filter(
            (transaction) =>
              transaction.type === "出金"
          )
          .reduce(
            (sum, transaction) =>
              sum +
              transaction.amount,
            0
          );

        const profit =
          officeIncome -
          officeExpense;

        const profitRate =
          officeIncome > 0
            ? (profit /
                officeIncome) *
              100
            : 0;

        return {
          office: item,
          income: officeIncome,
          expense: officeExpense,
          profit,
          profitRate,
        };
      });
  }, [transactions, month, financeOffices]);

  // ============================
  // 登録フォームを開く
  // ============================

  function openForm(
    selectedType: TransactionType
  ) {
    setEditingTransactionId(null);
    setType(selectedType);

    setCategory(
      selectedType === "入金"
        ? incomeCategories[0]
        : expenseCategories[0]
    );

    setDate(today());
    setAmount("");
    setHasTransferFee(false);
    setTransferFee("");
    setHasLeaseRevenue(false);
    setLeaseRevenueInput("33000");
    setIsVehicleExpense(false);
    setVehicleExpenseAmount("");
    setPartner("");
    setDescription("");
    setNote("");
    setShowForm(true);
  }

  // ============================
  // 入出金編集
  // ============================

  function editTransaction(item: Transaction) {
    setEditingTransactionId(item.id);
    setDate(item.date);
    setType(item.type);
    const savedTransferFee = item.transferFee || 0;
    setAmount(
      String(
        Math.max(
          0,
          item.amount - savedTransferFee
        )
      )
    );
    setHasTransferFee(
      item.type === "出金" &&
        savedTransferFee > 0
    );
    setTransferFee(
      savedTransferFee > 0
        ? String(savedTransferFee)
        : ""
    );
    const savedLeaseRevenue = item.leaseRevenue || 0;
    setHasLeaseRevenue(item.type === "出金" && savedLeaseRevenue > 0);
    setLeaseRevenueInput(savedLeaseRevenue > 0 ? String(savedLeaseRevenue) : "33000");
    setIsVehicleExpense(item.type === "出金" && item.isVehicleExpense === true);
    setVehicleExpenseAmount(
      item.vehicleExpenseAmount && item.vehicleExpenseAmount > 0
        ? String(item.vehicleExpenseAmount)
        : ""
    );
    setPartner(item.partner);
    setCategory(item.category);
    setDescription(item.description || "");
    setNote(item.note || "");
    setShowForm(true);
  }

  // ============================
  // 入出金保存・更新
  // ============================

  function saveTransaction() {
    const numericAmount = Number(
      amount.replace(/,/g, "")
    );

    const numericTransferFee =
      type === "出金" && hasTransferFee
        ? Number(
            transferFee.replace(/,/g, "")
          )
        : 0;

    const totalAmount =
      numericAmount + numericTransferFee;

    const numericLeaseRevenue =
      type === "出金" && hasLeaseRevenue
        ? Number(leaseRevenueInput.replace(/,/g, ""))
        : 0;

    const numericVehicleExpense =
      type === "出金" && isVehicleExpense
        ? Number(vehicleExpenseAmount.replace(/,/g, ""))
        : 0;

    if (!date) {
      alert(
        "日付を入力してください"
      );
      return;
    }

    if (!partner.trim()) {
      alert(
        "相手先を入力してください"
      );
      return;
    }

    if (
      !numericAmount ||
      numericAmount <= 0
    ) {
      alert(
        "金額を入力してください"
      );
      return;
    }

    if (
      type === "出金" &&
      hasTransferFee &&
      (!numericTransferFee ||
        numericTransferFee <= 0)
    ) {
      alert(
        "振込手数料を入力してください"
      );
      return;
    }

    if (
      type === "入金" &&
      hasLeaseRevenue &&
      (!numericLeaseRevenue || numericLeaseRevenue <= 0)
    ) {
      alert("リース売上を入力してください");
      return;
    }

    if (editingTransactionId) {
      const nextTransactions = transactions.map((item) =>
        item.id === editingTransactionId
          ? {
              ...item,
              date,
              type,
              amount: totalAmount,
              transferFee: numericTransferFee,
              leaseRevenue: numericLeaseRevenue,
              isVehicleExpense: false,
              vehicleExpenseAmount: 0,
              partner: partner.trim(),
              office: "全社共通",
              category,
              description: description.trim(),
              note: note.trim(),
            }
          : item
      );

      setTransactions(nextTransactions);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(nextTransactions)
      );

      setEditingTransactionId(null);
      setShowForm(false);
      return;
    }

    const newTransaction: Transaction = {
      id: `${Date.now()}-${Math.random()}`,
      date,
      type,
      amount: totalAmount,
      transferFee: numericTransferFee,
      leaseRevenue: numericLeaseRevenue,
      isVehicleExpense: false,
      vehicleExpenseAmount: 0,
      partner: partner.trim(),
      office: "全社共通",
      category,
      description: description.trim(),
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };

    const nextTransactions = [
      newTransaction,
      ...transactions,
    ];

    setTransactions(nextTransactions);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nextTransactions)
    );

    setShowForm(false);
  }

  // ============================
  // 車両経費 登録・編集
  // 通常の出金明細にも同じ1件として反映
  // ============================

  function openVehicleExpenseForm(
    item?: Transaction
  ) {
    if (item) {
      setEditingVehicleExpenseId(item.id);
      setVehicleExpenseDate(item.date);
      setVehicleExpenseValue(
        String(
          item.vehicleExpenseAmount ||
            item.amount
        )
      );
      setVehicleExpenseDescription(
        item.description || ""
      );
      setVehicleExpenseNote(
        item.note || ""
      );
    } else {
      setEditingVehicleExpenseId(null);
      setVehicleExpenseDate(
        `${month}-01`
      );
      setVehicleExpenseValue("");
      setVehicleExpenseDescription("");
      setVehicleExpenseNote("");
    }

    setShowVehicleExpenseForm(true);
  }

  function saveVehicleExpense() {
    const value = Number(
      vehicleExpenseValue.replace(/,/g, "")
    );

    if (!vehicleExpenseDate) {
      alert("日付を入力してください");
      return;
    }

    if (!value || value <= 0) {
      alert("車両経費の金額を入力してください");
      return;
    }

    if (!vehicleExpenseDescription.trim()) {
      alert("内容を入力してください");
      return;
    }

    if (editingVehicleExpenseId) {
      const nextTransactions =
        transactions.map((item) =>
          item.id === editingVehicleExpenseId
            ? {
                ...item,
                date: vehicleExpenseDate,
                type: "出金" as TransactionType,
                amount: value,
                transferFee: 0,
                leaseRevenue: 0,
                isVehicleExpense: true,
                vehicleExpenseAmount: value,
                partner: "車両経費",
                office: "全社共通",
                category: "その他経費",
                description:
                  vehicleExpenseDescription.trim(),
                note:
                  vehicleExpenseNote.trim(),
              }
            : item
        );

      setTransactions(nextTransactions);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(nextTransactions)
      );
    } else {
      const newTransaction: Transaction = {
        id: `vehicle-expense-${Date.now()}-${Math.random()}`,
        date: vehicleExpenseDate,
        type: "出金",
        amount: value,
        transferFee: 0,
        leaseRevenue: 0,
        isVehicleExpense: true,
        vehicleExpenseAmount: value,
        partner: "車両経費",
        office: "全社共通",
        category: "その他経費",
        description:
          vehicleExpenseDescription.trim(),
        note: vehicleExpenseNote.trim(),
        createdAt: new Date().toISOString(),
      };

      const nextTransactions = [
        newTransaction,
        ...transactions,
      ];

      setTransactions(nextTransactions);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(nextTransactions)
      );
    }

    setEditingVehicleExpenseId(null);
    setShowVehicleExpenseForm(false);
  }

  function deleteVehicleExpense(id: string) {
    if (
      !window.confirm(
        "この車両経費を削除しますか？\n通常の出金明細からも削除されます。"
      )
    ) {
      return;
    }

    const nextTransactions =
      transactions.filter(
        (item) => item.id !== id
      );

    setTransactions(nextTransactions);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nextTransactions)
    );
  }

  // ============================
  // 明細削除
  // ============================

  function deleteTransaction(
    id: string
  ) {
    if (
      !window.confirm(
        "この明細を削除しますか？"
      )
    ) {
      return;
    }

    const nextTransactions = transactions.filter(
      (item) => item.id !== id
    );

    setTransactions(nextTransactions);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nextTransactions)
    );
  }

  // ============================
  // 月初現金保存
  // ============================

  function saveOpeningCash() {
    const value =
      Number(
        openingCashInput.replace(
          /,/g,
          ""
        )
      ) || 0;

    try {
      const saved =
        localStorage.getItem(
          OPENING_CASH_KEY
        );

      const parsed = saved
        ? JSON.parse(saved)
        : {};

      parsed[month] = value;

      localStorage.setItem(
        OPENING_CASH_KEY,
        JSON.stringify(parsed)
      );

      setOpeningCash(value);

      alert(
        "月初現金を保存しました"
      );
    } catch {
      alert("保存に失敗しました");
    }
  }

  // ============================
  // バックアップ保存
  // ============================

  function downloadBackup() {
    try {
      const savedTransactions =
        localStorage.getItem(
          STORAGE_KEY
        );

      const savedOpeningCash =
        localStorage.getItem(
          OPENING_CASH_KEY
        );

      const backupData: FinanceBackup =
        {
          app: "UNITE Fleet",
          type: "finance-backup",
          version: 1,
          createdAt:
            new Date().toISOString(),

          transactions:
            savedTransactions
              ? JSON.parse(
                  savedTransactions
                )
              : [],

          openingCash:
            savedOpeningCash
              ? JSON.parse(
                  savedOpeningCash
                )
              : {},
        };

      const blob = new Blob(
        [
          JSON.stringify(
            backupData,
            null,
            2
          ),
        ],
        {
          type: "application/json",
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      const now = new Date();

      const fileDate =
        `${now.getFullYear()}-` +
        `${String(
          now.getMonth() + 1
        ).padStart(2, "0")}-` +
        `${String(
          now.getDate()
        ).padStart(2, "0")}`;

      link.href = url;

      link.download =
        `UNITE資金管理バックアップ_${fileDate}.json`;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      URL.revokeObjectURL(url);

      alert(
        "バックアップを保存しました"
      );
    } catch (error) {
      console.error(error);

      alert(
        "バックアップの保存に失敗しました"
      );
    }
  }

  // ============================
  // バックアップ復元
  // ============================

  function restoreBackup(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const backupData =
          JSON.parse(
            String(reader.result)
          ) as Partial<FinanceBackup>;

        if (
          backupData.app !==
            "UNITE Fleet" ||
          backupData.type !==
            "finance-backup" ||
          !Array.isArray(
            backupData.transactions
          )
        ) {
          alert(
            "UNITE Fleetの正しいバックアップファイルではありません"
          );

          input.value = "";
          return;
        }

        const ok =
          window.confirm(
            "現在の資金管理データをバックアップ内容で上書きします。\nよろしいですか？"
          );

        if (!ok) {
          input.value = "";
          return;
        }

        const restoredTransactions =
          backupData.transactions;

        const restoredOpeningCash =
          backupData.openingCash &&
          typeof backupData.openingCash ===
            "object"
            ? backupData.openingCash
            : {};

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            restoredTransactions
          )
        );

        localStorage.setItem(
          OPENING_CASH_KEY,
          JSON.stringify(
            restoredOpeningCash
          )
        );

        setTransactions(
          restoredTransactions
        );

        const monthOpeningCash =
          Number(
            restoredOpeningCash[
              month
            ] || 0
          );

        setOpeningCash(
          monthOpeningCash
        );

        setOpeningCashInput(
          monthOpeningCash
            ? String(
                monthOpeningCash
              )
            : ""
        );

        alert(
          "バックアップを復元しました"
        );

        input.value = "";
      } catch (error) {
        console.error(error);

        alert(
          "バックアップファイルを読み込めませんでした"
        );

        input.value = "";
      }
    };

    reader.onerror = () => {
      alert(
        "バックアップファイルを読み込めませんでした"
      );

      input.value = "";
    };

    reader.readAsText(file);
  }

  // ============================
  // 年収支
  // ============================

  const yearTransactions = useMemo(() => {
    return transactions.filter((item) => {
      return item.date.startsWith(`${year}-`);
    });
  }, [transactions, year, office]);

  const yearIncome = useMemo(
    () =>
      yearTransactions
        .filter((item) => item.type === "入金")
        .reduce((sum, item) => sum + item.amount, 0),
    [yearTransactions]
  );

  const yearExpense = useMemo(
    () =>
      yearTransactions
        .filter((item) => item.type === "出金")
        .reduce((sum, item) => sum + item.amount, 0),
    [yearTransactions]
  );

  const yearBalance = yearIncome - yearExpense;

  const yearBaseSales = useMemo(
    () =>
      yearTransactions
        .filter(
          (item) =>
            item.type === "入金" &&
            item.category === "売上入金"
        )
        .reduce((sum, item) => sum + item.amount, 0),
    [yearTransactions]
  );

  const yearBaseCostOfSales = useMemo(
    () =>
      yearTransactions
        .filter(
          (item) =>
            item.type === "出金" &&
            item.category === "ドライバー外注費"
        )
        .reduce((sum, item) => sum + item.amount, 0),
    [yearTransactions]
  );

  const yearLeaseSalesForGross = useMemo(
    () =>
      yearTransactions
        .filter((item) => item.type === "出金")
        .reduce(
          (sum, item) =>
            sum + (item.leaseRevenue || 0),
          0
        ),
    [yearTransactions]
  );

  const yearSales =
    yearBaseSales + yearLeaseSalesForGross;

  const yearCostOfSales =
    yearBaseCostOfSales + yearLeaseSalesForGross;

  const yearGrossProfit =
    yearSales - yearCostOfSales;

  const yearGrossProfitRate =
    yearSales > 0
      ? (yearGrossProfit / yearSales) * 100
      : 0;

  const getLeaseRevenueForMonth = (
    targetMonth: string
  ) =>
    transactions
      .filter(
        (item) =>
          item.type === "出金" &&
          item.date.startsWith(targetMonth)
      )
      .reduce(
        (sum, item) =>
          sum + (item.leaseRevenue || 0),
        0
      );

  const getVehicleExpenseForMonth = (
    targetMonth: string
  ) =>
    transactions
      .filter(
        (item) =>
          item.type === "出金" &&
          item.isVehicleExpense === true &&
          item.date.startsWith(targetMonth)
      )
      .reduce(
        (sum, item) =>
          sum + (item.vehicleExpenseAmount || 0),
        0
      );

  const yearMonthRows = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const monthNumber = index + 1;
      const monthKey = `${year}-${String(monthNumber).padStart(2, "0")}`;

      const list = transactions.filter((item) => {
        return item.date.startsWith(monthKey);
      });

      const monthIncome = list
        .filter((item) => item.type === "入金")
        .reduce((sum, item) => sum + item.amount, 0);

      const monthExpense = list
        .filter((item) => item.type === "出金")
        .reduce((sum, item) => sum + item.amount, 0);

      const monthBaseSales = list
        .filter(
          (item) =>
            item.type === "入金" &&
            item.category === "売上入金"
        )
        .reduce((sum, item) => sum + item.amount, 0);

      const monthBaseCostOfSales = list
        .filter(
          (item) =>
            item.type === "出金" &&
            item.category === "ドライバー外注費"
        )
        .reduce((sum, item) => sum + item.amount, 0);

      const monthLeaseRevenue = list
        .filter((item) => item.type === "出金")
        .reduce(
          (sum, item) =>
            sum + (item.leaseRevenue || 0),
          0
        );

      const monthSales =
        monthBaseSales + monthLeaseRevenue;

      const monthCostOfSales =
        monthBaseCostOfSales + monthLeaseRevenue;

      const monthGrossProfit =
        monthSales - monthCostOfSales;

      const monthGrossProfitRate =
        monthSales > 0
          ? (monthGrossProfit / monthSales) * 100
          : 0;

      return {
        monthNumber,
        monthKey,
        income: monthIncome,
        expense: monthExpense,
        balance: monthIncome - monthExpense,
        sales: monthSales,
        costOfSales: monthCostOfSales,
        grossProfit: monthGrossProfit,
        grossProfitRate: monthGrossProfitRate,
        leaseRevenue: monthLeaseRevenue,
        vehicleExpense: getVehicleExpenseForMonth(monthKey),
      };
    });
  }, [transactions, year]);

  const yearLeaseRevenue = useMemo(
    () =>
      yearMonthRows.reduce(
        (sum, item) => sum + item.leaseRevenue,
        0
      ),
    [yearMonthRows]
  );

  const yearVehicleExpense = useMemo(
    () =>
      yearMonthRows.reduce(
        (sum, item) => sum + item.vehicleExpense,
        0
      ),
    [yearMonthRows]
  );

  const yearVehicleProfit =
    yearLeaseRevenue - yearVehicleExpense;

  const openMonthFromYear = (monthKey: string) => {
    setMonth(monthKey);
    setViewMode("month");
  };

  const categories =
    type === "入金"
      ? incomeCategories
      : expenseCategories;

  // ============================
  // Hydration対策
  // localStorageの読み込みが完了するまでは
  // サーバーとブラウザで同じ画面を表示する
  // ============================

  if (!loaded) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-500">
              資金データを読み込み中...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ============================
  // 年収支画面
  // ============================

  if (viewMode === "year") {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                資金・損益管理
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                年間の入金・出金・収支を月別に確認
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex rounded-xl bg-white p-1 shadow">
                <button
                  type="button"
                  onClick={() => setViewMode("month")}
                  className="rounded-lg px-4 py-2 text-sm font-bold text-gray-600"
                >
                  月収支
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white"
                >
                  年収支
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  対象年
                </label>
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-32 rounded-lg border bg-white px-3 py-2"
                />
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-gray-900">💾 データバックアップ</p>
                <p className="mt-1 text-xs text-gray-500">
                  このPCの入出金履歴と月初現金を保存・復元できます
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={downloadBackup}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700"
                >
                  💾 バックアップ保存
                </button>
                <label className="cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow hover:bg-gray-50">
                  ♻️ バックアップ復元
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={restoreBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <p className="text-sm text-gray-500">表示中</p>
            <h2 className="text-xl font-bold">
              {year}年
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-gray-500">年間売上</p>
              <p className="mt-2 text-2xl font-bold text-green-600">
                {yen(yearSales)}
              </p>
              <p className="mt-1 text-xs text-gray-400">費目「売上入金」</p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-gray-500">年間原価</p>
              <p className="mt-2 text-2xl font-bold text-red-600">
                {yen(yearCostOfSales)}
              </p>
              <p className="mt-1 text-xs text-gray-400">ドライバー外注費</p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow">
              <p className="text-sm text-gray-500">年間粗利</p>
              <p className={`mt-2 text-2xl font-bold ${
                yearGrossProfit < 0 ? "text-red-600" : "text-blue-700"
              }`}>
                {yen(yearGrossProfit)}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow">
              <p className="text-sm text-gray-500">年間粗利率</p>
              <p className={`mt-2 text-2xl font-bold ${
                yearGrossProfitRate < 0 ? "text-red-600" : "text-blue-700"
              }`}>
                {yearGrossProfitRate.toFixed(1)}%
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-gray-500">年間入金</p>
              <p className="mt-2 text-2xl font-bold text-green-600">
                {yen(yearIncome)}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-gray-500">年間出金</p>
              <p className="mt-2 text-2xl font-bold text-red-600">
                {yen(yearExpense)}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow">
              <p className="text-sm text-gray-500">年間最終収支</p>
              <p className={`mt-2 text-2xl font-bold ${
                yearBalance < 0 ? "text-red-600" : "text-gray-900"
              }`}>
                {yen(yearBalance)}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow">
              <p className="text-sm text-gray-500">年間車両リース売上</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {yen(yearLeaseRevenue)}
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow">
            <div className="border-b p-5">
              <h2 className="text-lg font-bold">月別 粗利・収支</h2>
              <p className="mt-1 text-sm text-gray-500">
                月を押すと、その月の月収支を開きます
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead className="bg-gray-50 text-sm text-gray-500">
                  <tr>
                    <th className="px-4 py-3">月</th>
                    <th className="px-4 py-3 text-right">売上</th>
                    <th className="px-4 py-3 text-right">原価</th>
                    <th className="px-4 py-3 text-right">粗利</th>
                    <th className="px-4 py-3 text-right">粗利率</th>
                    <th className="px-4 py-3 text-right">入金</th>
                    <th className="px-4 py-3 text-right">出金</th>
                    <th className="px-4 py-3 text-right">最終収支</th>
                    <th className="px-4 py-3 text-right">リース売上</th>
                  </tr>
                </thead>
                <tbody>
                  {yearMonthRows.map((item) => (
                    <tr
                      key={item.monthKey}
                      onClick={() => openMonthFromYear(item.monthKey)}
                      className="cursor-pointer border-t hover:bg-gray-50"
                    >
                      <td className="px-4 py-4 font-bold">{item.monthNumber}月</td>
                      <td className="px-4 py-4 text-right text-green-600">{yen(item.sales)}</td>
                      <td className="px-4 py-4 text-right text-red-600">{yen(item.costOfSales)}</td>
                      <td className={`px-4 py-4 text-right font-bold ${
                        item.grossProfit < 0 ? "text-red-600" : "text-blue-700"
                      }`}>
                        {yen(item.grossProfit)}
                      </td>
                      <td className="px-4 py-4 text-right font-bold">
                        {item.grossProfitRate.toFixed(1)}%
                      </td>
                      <td className="px-4 py-4 text-right text-green-600">{yen(item.income)}</td>
                      <td className="px-4 py-4 text-right text-red-600">{yen(item.expense)}</td>
                      <td className={`px-4 py-4 text-right font-bold ${
                        item.balance < 0 ? "text-red-600" : ""
                      }`}>
                        {yen(item.balance)}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-emerald-700">
                        {yen(item.leaseRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 bg-gray-50 font-bold">
                  <tr>
                    <td className="px-4 py-4">年間合計</td>
                    <td className="px-4 py-4 text-right text-green-600">{yen(yearSales)}</td>
                    <td className="px-4 py-4 text-right text-red-600">{yen(yearCostOfSales)}</td>
                    <td className={`px-4 py-4 text-right ${
                      yearGrossProfit < 0 ? "text-red-600" : "text-blue-700"
                    }`}>
                      {yen(yearGrossProfit)}
                    </td>
                    <td className="px-4 py-4 text-right">{yearGrossProfitRate.toFixed(1)}%</td>
                    <td className="px-4 py-4 text-right text-green-600">{yen(yearIncome)}</td>
                    <td className="px-4 py-4 text-right text-red-600">{yen(yearExpense)}</td>
                    <td className={`px-4 py-4 text-right ${
                      yearBalance < 0 ? "text-red-600" : ""
                    }`}>
                      {yen(yearBalance)}
                    </td>
                    <td className="px-4 py-4 text-right text-emerald-700">{yen(yearLeaseRevenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow">
            <div className="border-b p-5">
              <h2 className="text-lg font-bold">
                📊 年間 経費負担率
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                各費目が年間売上に対して何％を占めているか確認できます
              </p>
            </div>

            {yearExpenseBurdenRows.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                経費データがありません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead className="bg-gray-50 text-sm text-gray-500">
                    <tr>
                      <th className="px-5 py-3">費目</th>
                      <th className="px-5 py-3 text-right">年間金額</th>
                      <th className="px-5 py-3 text-right">売上比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearExpenseBurdenRows.map((item) => (
                      <tr key={item.category} className="border-t">
                        <td className="px-5 py-4 font-bold">
                          {item.category}
                        </td>
                        <td className="px-5 py-4 text-right font-bold">
                          {yen(item.amount)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="inline-flex min-w-[72px] justify-center rounded-full bg-orange-50 px-3 py-1 font-bold text-orange-700">
                            {item.rate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow">
            ※ 粗利は「売上入金 − ドライバー外注費」で計算しています。
            入金・出金・最終収支は登録済みの入出金明細から集計し、
            車両リース売上は入金登録の「車両リース売上」から別枠で集計しています。
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">

        {/* ======================
            タイトル
        ====================== */}

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              資金・損益管理
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              実際の入金・出金をもとに資金状況を確認
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">

            <div className="flex rounded-xl bg-white p-1 shadow">
              <button
                type="button"
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white"
              >
                月収支
              </button>

              <button
                type="button"
                onClick={() => {
                  setYear(month.slice(0, 4));
                  setViewMode("year");
                }}
                className="rounded-lg px-4 py-2 text-sm font-bold text-gray-600"
              >
                年収支
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                対象月
              </label>

              <input
                type="month"
                value={month}
                onChange={(e) =>
                  setMonth(
                    e.target.value
                  )
                }
                className="rounded-lg border bg-white px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* ======================
            バックアップ
        ====================== */}

        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="font-bold text-gray-900">
                💾 データバックアップ
              </p>

              <p className="mt-1 text-xs text-gray-500">
                このPCの入出金履歴と月初現金を保存・復元できます
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={
                  downloadBackup
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700"
              >
                💾 バックアップ保存
              </button>

              <label className="cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow hover:bg-gray-50">
                ♻️ バックアップ復元

                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={
                    restoreBackup
                  }
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* ======================
            営業所切替
        ====================== */}

        {/* ======================
            登録ボタン
        ====================== */}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-500">
              表示中
            </p>

            <h2 className="text-xl font-bold">
              会社全体
            </h2>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() =>
                openForm("入金")
              }
              className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white shadow"
            >
              ＋ 入金登録
            </button>

            <button
              onClick={() =>
                openForm("出金")
              }
              className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white shadow"
            >
              － 出金登録
            </button>
          </div>
        </div>

        {/* ======================
            粗利カード
        ====================== */}

        <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">売上</p>
            <p className="mt-2 text-2xl font-bold text-green-600">
              {yen(sales)}
            </p>
            <p className="mt-1 text-xs text-gray-400">費目「売上入金」</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">原価</p>
            <p className="mt-2 text-2xl font-bold text-red-600">
              {yen(costOfSales)}
            </p>
            <p className="mt-1 text-xs text-gray-400">ドライバー外注費</p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow">
            <p className="text-sm text-gray-500">粗利</p>
            <p className={`mt-2 text-2xl font-bold ${
              grossProfit < 0 ? "text-red-600" : "text-blue-700"
            }`}>
              {yen(grossProfit)}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow">
            <p className="text-sm text-gray-500">粗利率</p>
            <p className={`mt-2 text-2xl font-bold ${
              grossProfitRate < 0 ? "text-red-600" : "text-blue-700"
            }`}>
              {grossProfitRate.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* ======================
            入出金・営業利益カード
        ====================== */}

        <div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              入金
            </p>

            <p className="mt-2 text-2xl font-bold text-green-600">
              {yen(income)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">
              出金
            </p>

            <p className="mt-2 text-2xl font-bold text-red-600">
              {yen(expense)}
            </p>
          </div>

          <div className="rounded-2xl border border-purple-100 bg-purple-50 p-5 shadow">
            <p className="text-sm text-gray-500">
              営業利益
            </p>

            <p
              className={`mt-2 text-2xl font-bold ${
                operatingProfit < 0
                  ? "text-red-600"
                  : "text-purple-700"
              }`}
            >
              {yen(operatingProfit)}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              粗利 − 車両経費 − その他営業経費
            </p>
          </div>

          <div className="rounded-2xl border border-purple-100 bg-purple-50 p-5 shadow">
            <p className="text-sm text-gray-500">
              営業利益率
            </p>

            <p
              className={`mt-2 text-2xl font-bold ${
                operatingProfitRate < 0
                  ? "text-red-600"
                  : "text-purple-700"
              }`}
            >
              {operatingProfitRate.toFixed(1)}%
            </p>

            <p className="mt-1 text-xs text-gray-400">
              営業利益 ÷ 売上
            </p>
          </div>
        </div>

        {/* ======================
            経費負担率
        ====================== */}
        <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow">
          <div className="border-b p-5">
            <h2 className="text-lg font-bold">
              📊 経費負担率
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              各費目が今月の売上に対して何％を占めているか確認できます
            </p>
          </div>

          {monthlyExpenseBurdenRows.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              今月の経費データがありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead className="bg-gray-50 text-sm text-gray-500">
                  <tr>
                    <th className="px-5 py-3">費目</th>
                    <th className="px-5 py-3 text-right">金額</th>
                    <th className="px-5 py-3 text-right">売上比</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyExpenseBurdenRows.map((item) => (
                    <tr key={item.category} className="border-t">
                      <td className="px-5 py-4 font-bold">
                        {item.category}
                      </td>
                      <td className="px-5 py-4 text-right font-bold">
                        {yen(item.amount)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="inline-flex min-w-[72px] justify-center rounded-full bg-orange-50 px-3 py-1 font-bold text-orange-700">
                          {item.rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ======================
            車両収支
        ====================== */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow">
          <div className="border-b border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">🚗 車両収支</h2>
                <p className="mt-1 text-sm text-gray-500">
                  リース売上と車両経費を集計
                </p>
                <button
                  type="button"
                  onClick={() =>
                    openVehicleExpenseForm()
                  }
                  className="mt-3 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700"
                >
                  ＋ 車両経費を登録
                </button>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">{month.replace("-", "年")}月</p>
                <p className={`text-2xl font-bold ${monthlyVehicleProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {yen(monthlyVehicleProfit)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-3">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">車両リース売上</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{yen(monthlyLeaseRevenue)}</p>
              <p className="mt-1 text-xs text-gray-400">現在現金には加算しません</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">車両経費</p>
              <p className="mt-2 text-2xl font-bold text-red-600">{yen(monthlyVehicleExpense)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">車両利益</p>
              <p className={`mt-2 text-2xl font-bold ${monthlyVehicleProfit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                {yen(monthlyVehicleProfit)}
              </p>
              <p className="mt-1 text-xs text-gray-400">リース売上 − 車両経費</p>
            </div>
          </div>

          <div className="border-t p-5">
            <h3 className="mb-3 font-bold">
              車両経費明細
            </h3>

            {monthTransactions.filter(
              (item) =>
                item.type === "出金" &&
                item.isVehicleExpense === true
            ).length === 0 ? (
              <p className="text-sm text-gray-400">
                今月の車両経費はありません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2">日付</th>
                      <th className="px-3 py-2">内容</th>
                      <th className="px-3 py-2">メモ</th>
                      <th className="px-3 py-2 text-right">金額</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthTransactions
                      .filter(
                        (item) =>
                          item.type === "出金" &&
                          item.isVehicleExpense === true
                      )
                      .slice()
                      .sort((a, b) =>
                        b.date.localeCompare(a.date)
                      )
                      .map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-3">
                            {item.date}
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {item.description || "-"}
                          </td>
                          <td className="px-3 py-3 text-gray-500">
                            {item.note || "-"}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-red-600">
                            {yen(item.vehicleExpenseAmount || item.amount)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openVehicleExpenseForm(item)
                                }
                                className="rounded-lg bg-yellow-400 px-3 py-2 font-bold text-black"
                              >
                                編集
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  deleteVehicleExpense(item.id)
                                }
                                className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white"
                              >
                                削除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ======================
            月初現金
        ====================== */}

        <div className="mt-5 rounded-2xl bg-white p-5 shadow">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">

              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">
                  {month.replace(
                    "-",
                    "年"
                  )}
                  月 月初現金
                </label>

                <input
                  type="number"
                  value={
                    openingCashInput
                  }
                  onChange={(e) =>
                    setOpeningCashInput(
                      e.target.value
                    )
                  }
                  placeholder="例：6000000"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <button
                onClick={
                  saveOpeningCash
                }
                className="rounded-lg bg-gray-900 px-5 py-2 font-bold text-white"
              >
                月初現金を保存
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-500">
              月初現金{" "}
              {yen(openingCash)} ＋
              入金{" "}
              {yen(companyIncome)} −
              出金{" "}
              {yen(companyExpense)} ＝
              現在現金{" "}
              {yen(currentCash)}
            </p>
          </div>

        {/* ======================
            入出金明細
        ====================== */}

        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow">

          <div className="border-b p-5">
            <h2 className="text-lg font-bold">
              入出金明細
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {month.replace(
                "-",
                "年"
              )}
              月
            </p>
          </div>

          <div className="border-t bg-gray-50 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900">
                  🔎 明細検索・絞り込み
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  複数の条件を組み合わせて検索できます
                </p>
              </div>
              <button
                type="button"
                onClick={resetDetailFilters}
                className="rounded-lg border bg-white px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100"
              >
                条件クリア
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">
                  相手先・名前
                </label>
                <input
                  type="text"
                  value={searchPartner}
                  onChange={(e) => setSearchPartner(e.target.value)}
                  placeholder="例：仲村"
                  className="w-full rounded-lg border bg-white px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">
                  内容
                </label>
                <input
                  type="text"
                  value={searchDescription}
                  onChange={(e) => setSearchDescription(e.target.value)}
                  placeholder="例：顧問料"
                  className="w-full rounded-lg border bg-white px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">
                  区分
                </label>
                <select
                  value={filterType}
                  onChange={(e) =>
                    setFilterType(
                      e.target.value as "すべて" | TransactionType
                    )
                  }
                  className="w-full rounded-lg border bg-white px-3 py-2"
                >
                  <option value="すべて">すべて</option>
                  <option value="入金">入金のみ</option>
                  <option value="出金">出金のみ</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">
                  振込手数料
                </label>
                <select
                  value={filterTransferFee}
                  onChange={(e) =>
                    setFilterTransferFee(
                      e.target.value as "すべて" | "あり" | "なし"
                    )
                  }
                  className="w-full rounded-lg border bg-white px-3 py-2"
                >
                  <option value="すべて">すべて</option>
                  <option value="あり">あり</option>
                  <option value="なし">なし</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">
                  リース売上
                </label>
                <select
                  value={filterLeaseRevenue}
                  onChange={(e) =>
                    setFilterLeaseRevenue(
                      e.target.value as "すべて" | "あり" | "なし"
                    )
                  }
                  className="w-full rounded-lg border bg-white px-3 py-2"
                >
                  <option value="すべて">すべて</option>
                  <option value="あり">あり</option>
                  <option value="なし">なし</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500">
                  車両経費
                </label>
                <select
                  value={filterVehicleExpense}
                  onChange={(e) =>
                    setFilterVehicleExpense(
                      e.target.value as "すべて" | "あり" | "なし"
                    )
                  }
                  className="w-full rounded-lg border bg-white px-3 py-2"
                >
                  <option value="すべて">すべて</option>
                  <option value="あり">あり</option>
                  <option value="なし">なし</option>
                </select>
              </div>
            </div>

            <div className="mt-3 text-sm font-bold text-gray-600">
              表示件数：{filteredMonthTransactions.length}件 / {monthTransactions.length}件
            </div>
          </div>

          {monthTransactions.length ===
          0 ? (
            <div className="p-10 text-center text-gray-400">
              まだ入出金データがありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">

                <thead className="bg-gray-50 text-sm text-gray-500">
                  <tr>
                    <th className="px-4 py-3">
                      日付
                    </th>

                    <th className="whitespace-nowrap px-4 py-3">
                      区分
                    </th>

                    <th className="px-4 py-3">
                      相手先
                    </th>

                    <th className="px-4 py-3">
                      内容
                    </th>

                    <th className="px-4 py-3 text-right">
                      振込手数料
                    </th>

                    <th className="px-4 py-3 text-right">
                      リース売上
                    </th>
                    <th className="px-4 py-3">
                      車両経費
                    </th>
                    <th className="px-4 py-3 text-right">
                      金額
                    </th>

                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMonthTransactions
                    .slice()
                    .sort((a, b) =>
                      b.date.localeCompare(
                        a.date
                      )
                    )
                    .map((item) => (
                      <tr
                        key={item.id}
                        className="border-t"
                      >
                        <td className="whitespace-nowrap px-4 py-4">
                          {item.date}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`inline-flex min-w-[52px] items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${
                              item.type ===
                              "入金"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {
                              item.type
                            }
                          </span>
                        </td>

                        <td className="px-4 py-4 font-medium">
                          {
                            item.partner
                          }
                        </td>

                        <td className="px-4 py-4">
                          {item.description ||
                            "-"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          {item.type === "出金" &&
                          (item.transferFee || 0) > 0
                            ? yen(item.transferFee || 0)
                            : "-"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          {item.type === "出金" && (item.leaseRevenue || 0) > 0
                            ? yen(item.leaseRevenue || 0)
                            : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {item.type === "出金" &&
                          (item.vehicleExpenseAmount || 0) > 0
                            ? yen(item.vehicleExpenseAmount || 0)
                            : "-"}
                        </td>

                        <td
                          className={`whitespace-nowrap px-4 py-4 text-right font-bold ${
                            item.type ===
                            "入金"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {item.type ===
                          "入金"
                            ? "+"
                            : "-"}

                          {yen(
                            item.amount
                          )}
                        </td>

                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                item.isVehicleExpense === true
                                  ? openVehicleExpenseForm(item)
                                  : editTransaction(item)
                              }
                              className="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-black hover:bg-yellow-500"
                            >
                              編集
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteTransaction(
                                  item.id
                                )
                              }
                              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
                <div className="border-t-2 border-gray-300 bg-gray-50 p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-bold">検索結果の合計</h3>
                    <span className="text-sm text-gray-500">
                      {filteredMonthTransactions.length}件
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl bg-white p-4">
                      <p className="text-xs text-gray-500">入金合計</p>
                      <p className="mt-1 text-lg font-bold text-green-600">{yen(filteredIncomeTotal)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-4">
                      <p className="text-xs text-gray-500">出金合計</p>
                      <p className="mt-1 text-lg font-bold text-red-600">{yen(filteredExpenseTotal)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-4">
                      <p className="text-xs text-gray-500">差引合計</p>
                      <p className={`mt-1 text-lg font-bold ${filteredNetTotal < 0 ? "text-red-600" : "text-gray-900"}`}>
                        {yen(filteredNetTotal)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-4">
                      <p className="text-xs text-gray-500">振込手数料合計</p>
                      <p className="mt-1 text-lg font-bold">{yen(filteredTransferFeeTotal)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-4">
                      <p className="text-xs text-gray-500">リース売上合計</p>
                      <p className="mt-1 text-lg font-bold text-emerald-700">{yen(filteredLeaseRevenueTotal)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-4">
                      <p className="text-xs text-gray-500">車両経費合計</p>
                      <p className="mt-1 text-lg font-bold text-red-600">{yen(filteredVehicleExpenseTotal)}</p>
                    </div>
                  </div>
                </div>

            </div>
          )}
        </div>
      </div>

      {/* ======================
          入出金登録モーダル
      ====================== */}

      {showVehicleExpenseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  車両収支
                </p>
                <h2 className="text-xl font-bold">
                  {editingVehicleExpenseId
                    ? "車両経費を編集"
                    : "車両経費を登録"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowVehicleExpenseForm(false);
                  setEditingVehicleExpenseId(null);
                }}
                className="text-2xl text-gray-400"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  日付
                </label>
                <input
                  type="date"
                  value={vehicleExpenseDate}
                  onChange={(e) =>
                    setVehicleExpenseDate(e.target.value)
                  }
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  金額
                </label>
                <input
                  type="number"
                  min="0"
                  value={vehicleExpenseValue}
                  onChange={(e) =>
                    setVehicleExpenseValue(e.target.value)
                  }
                  placeholder="例：50000"
                  className="w-full rounded-lg border px-3 py-2 text-lg font-bold"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  内容
                </label>
                <input
                  type="text"
                  value={vehicleExpenseDescription}
                  onChange={(e) =>
                    setVehicleExpenseDescription(e.target.value)
                  }
                  placeholder="例：車両修理代"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  メモ
                </label>
                <textarea
                  value={vehicleExpenseNote}
                  onChange={(e) =>
                    setVehicleExpenseNote(e.target.value)
                  }
                  placeholder="任意"
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div className="rounded-xl bg-orange-50 p-4 text-sm text-orange-800">
                保存すると車両経費に計上し、通常の出金・最終収支・現在現金にも同じ金額を1回だけ反映します。
              </div>

              <button
                type="button"
                onClick={saveVehicleExpense}
                className="rounded-xl bg-orange-600 px-5 py-3 font-bold text-white hover:bg-orange-700"
              >
                {editingVehicleExpenseId
                  ? "変更を保存"
                  : "車両経費を保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">

            <div className="mb-5 flex items-center justify-between">

              <div>
                <p className="text-sm text-gray-500">
                  {editingTransactionId ? "明細編集" : "新規登録"}
                </p>

                <h2 className="text-xl font-bold">
                  {editingTransactionId
                  ? `${type}明細を編集`
                  : `${type}登録`}
                </h2>
              </div>

              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingTransactionId(null);
                }}
                className="text-2xl text-gray-400"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4">

              <div>
                <label className="mb-1 block text-sm font-medium">
                  日付
                </label>

                <input
                  type="date"
                  value={date}
                  onChange={(e) =>
                    setDate(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  {type === "出金"
                    ? "出金金額（手数料を除く）"
                    : "金額"}
                </label>

                <input
                  type="number"
                  value={amount}
                  onChange={(e) =>
                    setAmount(
                      e.target.value
                    )
                  }
                  placeholder="例：2800000"
                  className="w-full rounded-lg border px-3 py-2 text-lg font-bold"
                />
              </div>

              {type === "出金" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <label className="mb-3 block text-sm font-bold">リース売上</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setHasLeaseRevenue(false)}
                      className={`flex-1 rounded-lg border px-4 py-2 font-bold ${!hasLeaseRevenue ? "bg-gray-900 text-white" : "bg-white"}`}>
                      なし
                    </button>
                    <button type="button" onClick={() => { setHasLeaseRevenue(true); if (!leaseRevenueInput) setLeaseRevenueInput("33000"); }}
                      className={`flex-1 rounded-lg border px-4 py-2 font-bold ${hasLeaseRevenue ? "bg-emerald-600 text-white" : "bg-white"}`}>
                      あり
                    </button>
                  </div>
                  {hasLeaseRevenue && (
                    <div className="mt-3">
                      <label className="mb-1 block text-sm text-gray-600">リース売上金額</label>
                      <input type="number" min="0" value={leaseRevenueInput}
                        onChange={(e) => setLeaseRevenueInput(e.target.value)}
                        placeholder="33000"
                        className="w-full rounded-lg border bg-white px-3 py-2 text-lg font-bold" />
                      <p className="mt-2 text-xs text-gray-500">通常33,000円。今月だけ20,000円など自由に変更できます。売上として計上します。</p>
                    </div>
                  )}
                </div>
              )}

              {type === "出金" && (
                <div className="rounded-xl border bg-gray-50 p-4">
                  <label className="mb-3 block text-sm font-bold">
                    振込手数料
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHasTransferFee(false);
                        setTransferFee("");
                      }}
                      className={`flex-1 rounded-lg border px-4 py-2 font-bold ${
                        !hasTransferFee
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "bg-white text-gray-700"
                      }`}
                    >
                      なし
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setHasTransferFee(true)
                      }
                      className={`flex-1 rounded-lg border px-4 py-2 font-bold ${
                        hasTransferFee
                          ? "border-red-600 bg-red-600 text-white"
                          : "bg-white text-gray-700"
                      }`}
                    >
                      あり
                    </button>
                  </div>

                  {hasTransferFee && (
                    <div className="mt-3">
                      <label className="mb-1 block text-sm text-gray-600">
                        手数料金額
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={transferFee}
                        onChange={(e) =>
                          setTransferFee(
                            e.target.value
                          )
                        }
                        placeholder="例：440"
                        className="w-full rounded-lg border bg-white px-3 py-2 text-lg font-bold"
                      />
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <span className="text-sm font-bold text-gray-600">
                      合計出金額
                    </span>
                    <span className="text-lg font-bold text-red-600">
                      {yen(
                        (Number(
                          amount.replace(/,/g, "")
                        ) || 0) +
                          (hasTransferFee
                            ? Number(
                                transferFee.replace(/,/g, "")
                              ) || 0
                            : 0)
                      )}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  相手先
                </label>

                <input
                  type="text"
                  value={partner}
                  onChange={(e) =>
                    setPartner(
                      e.target.value
                    )
                  }
                  placeholder={
                    type === "入金"
                      ? "例：佐川急便"
                      : "例：横溝 一泰"
                  }
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  費目
                </label>

                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border bg-white px-3 py-2"
                >
                  {categories.map(
                    (item) => (
                      <option
                        key={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  内容
                </label>

                <input
                  type="text"
                  value={description}
                  onChange={(e) =>
                    setDescription(
                      e.target.value
                    )
                  }
                  placeholder="例：8月配送分"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  備考
                </label>

                <textarea
                  value={note}
                  onChange={(e) =>
                    setNote(
                      e.target.value
                    )
                  }
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <button
                onClick={
                  saveTransaction
                }
                className={`mt-2 rounded-xl py-3 font-bold text-white ${
                  type === "入金"
                    ? "bg-green-600"
                    : "bg-red-600"
                }`}
              >
                {editingTransactionId
                  ? "変更を保存"
                  : `${type}を保存`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}