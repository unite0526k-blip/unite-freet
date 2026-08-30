"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createWorker, PSM } from "tesseract.js";

type Vehicle = {
  id: number;
  office: string;
  number: string;
  driver: string;
  status: "貸出中" | "保管中" | "廃車";
  storageLocation: string;
  inspection: string;
  insurance: string;
  maker: string;
  model: string;
  chassisNumber: string;
  firstRegistration: string;
  userName: string;
  ownerName: string;
};

type VehicleForm = Omit<Vehicle, "id">;
type TextFieldKey =
  | "number"
  | "driver"
  | "storageLocation"
  | "maker"
  | "model"
  | "chassisNumber"
  | "firstRegistration"
  | "userName"
  | "ownerName";

const STORAGE_KEY = "unite-fleet-vehicles";

const OFFICES = [
  "松阪営業所",
  "伊勢営業所",
  "鈴鹿営業所",
  "伊賀営業所",
  "浜松営業所",
  "京都営業所",
];

const KNOWN_DRIVERS = [
  "吉田健人",
  "清水國光",
  "清水光真",
  "徳田亮太",
  "横溝一泰",
  "中川昭治",
  "楠滝空杜",
  "真田拓海",
  "齋藤朋樹",
  "福田華月",
  "垣内連",
  "伊藤圭志",
  "東真規",
  "勝村武史",
  "藤原颯士",
  "西田勇太",
  "仲村賢一郎",
  "山崎雅也",
  "辻本顕寛",
  "小倉祐司",
  "津嘉山一君",
  "藤田祥範",
  "レイネルセバスチャン",
];

const EMPTY_FORM: VehicleForm = {
  office: "",
  number: "",
  driver: "",
  status: "保管中",
  storageLocation: "",
  inspection: "",
  insurance: "",
  maker: "",
  model: "",
  chassisNumber: "",
  firstRegistration: "",
  userName: "",
  ownerName: "",
};

const compact = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(/[ー―‐‑–—−＿_]/g, "-");

const linesOf = (text: string) =>
  text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const pad2 = (value: string | number) => String(value).padStart(2, "0");

const eraToYear = (era: string, yearValue: string) => {
  const year = yearValue === "元" ? 1 : Number(yearValue);
  const starts: Record<string, number> = { 令和: 2018, 平成: 1988, 昭和: 1925 };
  return (starts[era] ?? 0) + year;
};

const extractDates = (text: string) => {
  const source = text.normalize("NFKC");
  const dates: string[] = [];

  for (const match of source.matchAll(
    /(20\d{2})\s*[年/.\-]\s*(\d{1,2})\s*[月/.\-]\s*(\d{1,2})\s*日?/g,
  )) {
    dates.push(`${match[1]}-${pad2(match[2])}-${pad2(match[3])}`);
  }

  for (const match of source.matchAll(
    /(令和|平成|昭和)\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g,
  )) {
    dates.push(
      `${eraToYear(match[1], match[2])}-${pad2(match[3])}-${pad2(match[4])}`,
    );
  }

  return [...new Set(dates)].filter((date) => {
    const time = new Date(`${date}T00:00:00`).getTime();
    return Number.isFinite(time) && date >= "1980-01-01" && date <= "2100-12-31";
  });
};

const extractYearMonths = (text: string) => {
  const source = text.normalize("NFKC");
  const values: string[] = [];

  for (const match of source.matchAll(/(20\d{2})\s*[年/.\-]\s*(\d{1,2})\s*月?/g)) {
    values.push(`${match[1]}-${pad2(match[2])}`);
  }

  for (const match of source.matchAll(
    /(令和|平成|昭和)\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月/g,
  )) {
    values.push(`${eraToYear(match[1], match[2])}-${pad2(match[3])}`);
  }

  return [...new Set(values)].filter((value) => value >= "1980-01" && value <= "2100-12");
};

const windowNearLabel = (text: string, labels: string[], before = 1, after = 6) => {
  const lines = linesOf(text);
  for (let index = 0; index < lines.length; index += 1) {
    if (!labels.some((label) => compact(lines[index]).includes(compact(label)))) continue;
    return lines
      .slice(Math.max(0, index - before), Math.min(lines.length, index + after + 1))
      .join("\n");
  }
  return "";
};

const valueNearLabel = (text: string, labels: string[]) => {
  const lines = linesOf(text);
  const allLabels = [
    "自動車登録番号又は車両番号",
    "車両番号",
    "車台番号",
    "車名",
    "型式",
    "初度登録年月",
    "初度検査年月",
    "使用者の氏名又は名称",
    "所有者の氏名又は名称",
    "有効期間の満了する日",
  ];

  for (let index = 0; index < lines.length; index += 1) {
    const line = compact(lines[index]);
    for (const label of labels) {
      const normalizedLabel = compact(label);
      const position = line.indexOf(normalizedLabel);
      if (position < 0) continue;

      const sameLine = line
        .slice(position + normalizedLabel.length)
        .replace(/^[:：・|\-]+/, "");
      if (sameLine.length >= 2) return sameLine;

      for (let offset = 1; offset <= 5; offset += 1) {
        const candidate = lines[index + offset]?.trim() ?? "";
        if (!candidate) continue;
        if (allLabels.some((item) => compact(candidate).includes(compact(item)))) continue;
        return candidate;
      }
    }
  }
  return "";
};

const detectDriver = (text: string) => {
  const source = compact(text);
  return KNOWN_DRIVERS.find((name) => source.includes(compact(name))) ?? "";
};

const parseVehicleText = (text: string): Partial<VehicleForm> => {
  const normalized = compact(text).toUpperCase();

  let chassisNumber =
    normalized.match(/[A-Z]{1,5}\d{0,4}[A-Z]?-\d{5,10}/)?.[0] ??
    normalized.match(/[A-Z0-9]{3,10}-[A-Z0-9]{5,12}/)?.[0] ??
    "";
  if (/^321V-/.test(chassisNumber)) chassisNumber = `S${chassisNumber}`;

  const plateRegion = ["伊勢志摩", "京都", "浜松", "三重", "鈴鹿"]
    .find((region) => compact(text).includes(region)) ?? "";
  const plateMatch = text
    .normalize("NFKC")
    .match(/(?:伊勢志摩|京都|浜松|三重|鈴鹿)?\s*(\d{3})\s*([ぁ-ん])\s*(\d{1,4})/);
  const number = plateMatch
    ? `${plateRegion}${plateMatch[1]}${plateMatch[2]}${plateMatch[3]}`
    : valueNearLabel(text, ["自動車登録番号又は車両番号", "車両番号"]);

  const firstRegistrationWindow = windowNearLabel(text, [
    "初度登録年月",
    "初度検査年月",
  ]);
  const firstRegistration =
    extractYearMonths(firstRegistrationWindow)[0] ?? "";

  const inspectionWindow = windowNearLabel(text, [
    "有効期間の満了する日",
    "有効期間満了日",
  ]);
  const inspectionDates = extractDates(inspectionWindow);
  const allDates = extractDates(text).sort();
  const inspection =
    inspectionDates.sort().at(-1) ?? allDates.at(-1) ?? "";

  const driver = detectDriver(text);
  const rawUserName = valueNearLabel(text, [
    "使用者の氏名又は名称",
    "使用者氏名",
  ]);
  const rawOwnerName = valueNearLabel(text, [
    "所有者の氏名又は名称",
    "所有者氏名",
  ]);
  const ownerName =
    /UN\s*I\s*T\s*E/i.test(text) || normalized.includes("HAZUNITE")
      ? "株式会社UNITE"
      : rawOwnerName;

  const isHijet = /^(S3(2|3|5|7|1)|S5(0|1|2|3|4|5|6|7|8|9))/.test(chassisNumber);

  return {
    number,
    driver,
    maker: isHijet ? "ダイハツ" : valueNearLabel(text, ["車名"]),
    model: isHijet ? "ハイゼットカーゴ" : "",
    chassisNumber,
    firstRegistration,
    userName: rawUserName || driver,
    ownerName,
    inspection,
  };
};

const parseInsuranceDate = (text: string) => {
  const nearPeriod = windowNearLabel(text, [
    "保険期間",
    "保険終期",
    "満期日",
    "保険期限",
  ]);
  return (extractDates(nearPeriod).sort().at(-1) ?? extractDates(text).sort().at(-1) ?? "");
};

export default function OcrPage() {
  const router = useRouter();
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  const [vehicleText, setVehicleText] = useState("");
  const [insuranceText, setInsuranceText] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "車検証記録事項のPDFまたは画像を選択してください。",
  );
  const [loadingType, setLoadingType] = useState<"vehicle" | "insurance" | null>(null);
  const [progress, setProgress] = useState(0);

  const updateField = <K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const readImage = async (source: File | string) => {
    const worker = await createWorker("jpn+eng", 1, {
      logger: (message) => {
        if (message.status === "recognizing text") {
          setProgress(Math.round((message.progress ?? 0) * 100));
        }
      },
    });

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
      });
      const sparse = await worker.recognize(source);

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1",
      });
      const automatic = await worker.recognize(source);

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
      });
      const block = await worker.recognize(source);

      return `${sparse.data.text}\n${automatic.data.text}\n${block.data.text}`.trim();
    } finally {
      await worker.terminate();
    }
  };

  const readPdf = async (file: File) => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const results: string[] = [];
    const pageCount = Math.min(pdf.numPages, 3);

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      setStatusMessage(`PDF ${pageNumber}/${pageCount}ページを読み取っています…`);
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const embeddedText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join("\n");

      const viewport = page.getViewport({ scale: 2.8 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("PDFを画像へ変換できませんでした。");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;

      const ocrText = await readImage(canvas.toDataURL("image/png"));
      results.push(embeddedText, ocrText);
    }

    const result = results.filter(Boolean).join("\n").trim();
    if (!result) throw new Error("PDFから文字を取得できませんでした。");
    return result;
  };

  const readFile = async (file: File) =>
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      ? readPdf(file)
      : readImage(file);

  const handleVehicleFile = async (file?: File) => {
    if (!file) return;
    try {
      setLoadingType("vehicle");
      setProgress(0);
      setStatusMessage("車検証を読み取っています…");
      const text = await readFile(file);
      const extracted = parseVehicleText(text);
      setVehicleText(text);
      setForm((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(extracted).filter(([, value]) => Boolean(value)),
        ),
      } as VehicleForm));
      setStatusMessage("読み取り完了。黄色の未確認項目を確認してから登録してください。");
    } catch (error) {
      setStatusMessage(
        `読み取りに失敗しました：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoadingType(null);
      setProgress(0);
    }
  };

  const handleInsuranceFile = async (file?: File) => {
    if (!file) return;
    try {
      setLoadingType("insurance");
      setProgress(0);
      setStatusMessage("任意保険を読み取っています…");
      const text = await readFile(file);
      const date = parseInsuranceDate(text);
      setInsuranceText(text);
      if (date) updateField("insurance", date);
      setStatusMessage(
        date ? `保険期限 ${date} を抽出しました。` : "保険期限を抽出できませんでした。手入力してください。",
      );
    } catch (error) {
      setStatusMessage(
        `読み取りに失敗しました：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoadingType(null);
      setProgress(0);
    }
  };

  const registerVehicle = () => {
    if (!form.office || !form.number) {
      window.alert("営業所と車番は必須です。");
      return;
    }
    if (!form.chassisNumber || !form.inspection) {
      const proceed = window.confirm(
        "車台番号または車検期限が空欄です。このまま登録しますか？",
      );
      if (!proceed) return;
    }

    let vehicles: Vehicle[] = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      vehicles = saved ? (JSON.parse(saved) as Vehicle[]) : [];
    } catch {
      window.alert("現在の車両データを確認できないため登録を中止しました。");
      return;
    }

    const duplicate = vehicles.find(
      (vehicle) =>
        compact(vehicle.number) === compact(form.number) ||
        (form.chassisNumber && compact(vehicle.chassisNumber) === compact(form.chassisNumber)),
    );
    if (duplicate) {
      window.alert(`同じ車番または車台番号の車両が登録済みです：${duplicate.number}`);
      return;
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...vehicles, { id: Date.now(), ...form }]),
    );
    window.alert("車両一覧へ登録しました。");
    router.push("/vehicles");
  };

  const textFields: Array<{ key: TextFieldKey; label: string }> = [
    { key: "number", label: "車番" },
    { key: "driver", label: "担当ドライバー" },
    { key: "storageLocation", label: "保管場所" },
    { key: "maker", label: "メーカー" },
    { key: "model", label: "車種" },
    { key: "chassisNumber", label: "車台番号" },
    { key: "firstRegistration", label: "初度登録年月" },
    { key: "userName", label: "使用者名" },
    { key: "ownerName", label: "所有者名" },
  ];

  const isLoading = loadingType !== null;

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">📄 車検証OCR登録</h1>
            <p className="mt-1 text-slate-600">抽出結果を確認してから車両一覧へ登録します。</p>
          </div>
          <Link href="/vehicles" className="rounded-lg bg-slate-700 px-4 py-2 font-bold text-white">
            車両管理へ戻る
          </Link>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="font-bold">
              車検証記録事項PDF・画像
              <input
                type="file"
                accept=".pdf,image/*"
                disabled={isLoading}
                onChange={(event) => void handleVehicleFile(event.target.files?.[0])}
                className="mt-2 block w-full rounded-lg border p-3 font-normal"
              />
            </label>
            <label className="font-bold">
              任意保険PDF・画像
              <input
                type="file"
                accept=".pdf,image/*"
                disabled={isLoading}
                onChange={(event) => void handleInsuranceFile(event.target.files?.[0])}
                className="mt-2 block w-full rounded-lg border p-3 font-normal"
              />
            </label>
          </div>
          <p className="mt-4 rounded-lg bg-slate-100 p-3 font-bold">{statusMessage}</p>
          {isLoading && (
            <div className="mt-3">
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-sm text-slate-600">OCR処理中 {progress}%</p>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-2xl font-bold">抽出結果の確認</h2>
          <p className="mt-1 text-sm text-amber-700">OCRは誤読する場合があります。車検期限と車台番号は必ず原本と照合してください。</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="font-bold">
              営業所
              <select
                value={form.office}
                onChange={(event) => updateField("office", event.target.value)}
                className={`mt-1 w-full rounded-lg border p-2 font-normal ${!form.office ? "bg-amber-50" : ""}`}
              >
                <option value="">営業所を選択</option>
                {OFFICES.map((office) => <option key={office}>{office}</option>)}
              </select>
            </label>
            <label className="font-bold">
              貸出状況
              <select
                value={form.status}
                onChange={(event) => updateField("status", event.target.value as Vehicle["status"])}
                className="mt-1 w-full rounded-lg border p-2 font-normal"
              >
                <option>貸出中</option>
                <option>保管中</option>
                <option>廃車</option>
              </select>
            </label>

            {textFields.map(({ key, label }) => (
              <label key={key} className="font-bold">
                {label}
                <input
                  value={String(form[key])}
                  onChange={(event) => updateField(key, event.target.value)}
                  className={`mt-1 w-full rounded-lg border p-2 font-normal ${!form[key] ? "bg-amber-50" : ""}`}
                />
              </label>
            ))}

            <label className="font-bold">
              車検期限
              <input
                type="date"
                value={form.inspection}
                onChange={(event) => updateField("inspection", event.target.value)}
                className={`mt-1 w-full rounded-lg border p-2 font-normal ${!form.inspection ? "bg-amber-50" : ""}`}
              />
            </label>
            <label className="font-bold">
              保険期限
              <input
                type="date"
                value={form.insurance}
                onChange={(event) => updateField("insurance", event.target.value)}
                className={`mt-1 w-full rounded-lg border p-2 font-normal ${!form.insurance ? "bg-amber-50" : ""}`}
              />
            </label>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={registerVehicle}
            className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:bg-slate-400"
          >
            確認して車両一覧へ登録
          </button>

          {vehicleText && (
            <details className="mt-6">
              <summary className="cursor-pointer font-bold">車検証OCR全文</summary>
              <textarea readOnly value={vehicleText} className="mt-2 h-64 w-full rounded-lg border p-3 text-sm" />
            </details>
          )}
          {insuranceText && (
            <details className="mt-4">
              <summary className="cursor-pointer font-bold">任意保険OCR全文</summary>
              <textarea readOnly value={insuranceText} className="mt-2 h-64 w-full rounded-lg border p-3 text-sm" />
            </details>
          )}
        </section>
      </div>
    </main>
  );
}
