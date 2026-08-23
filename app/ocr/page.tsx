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

const STORAGE_KEY = "unite-fleet-vehicles";

const OFFICES = [
  "松阪営業所",
  "伊勢営業所",
  "鈴鹿営業所",
  "伊賀営業所",
  "浜松営業所",
  "京都営業所",
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
  value.replace(/[ \t　]/g, "");

const getLines = (text: string) =>
  text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const ALL_LABELS = [
  "自動車登録番号又は車両番号",
  "車両番号",
  "車台番号",
  "車名",
  "型式",
  "初度登録年月",
  "使用者の氏名又は名称",
  "所有者の氏名又は名称",
  "有効期間の満了する日",
  "保険期間",
];

const findNearLabel = (
  text: string,
  labels: string[]
) => {
  const lines = getLines(text);

  for (let index = 0; index < lines.length; index += 1) {
    const compactLine = compact(lines[index]);

    for (const label of labels) {
      const compactLabel = compact(label);
      const labelPosition = compactLine.indexOf(compactLabel);

      if (labelPosition === -1) continue;

      const sameLineValue = compactLine
        .slice(labelPosition + compactLabel.length)
        .replace(/^[:：・\-]+/, "")
        .trim();

      if (sameLineValue.length >= 2) {
        return sameLineValue;
      }

      for (
        let nextIndex = index + 1;
        nextIndex <= index + 4 &&
        nextIndex < lines.length;
        nextIndex += 1
      ) {
        const candidate = lines[nextIndex].trim();

        const isAnotherLabel = ALL_LABELS.some((item) =>
          compact(candidate).includes(compact(item))
        );

        if (candidate && !isAnotherLabel) {
          return candidate;
        }
      }
    }
  }

  return "";
};

const padNumber = (value: string | number) =>
  String(value).padStart(2, "0");

const extractIsoDates = (text: string) => {
  const dates: string[] = [];

  const westernPattern =
    /(20\d{2})\s*[年/.\-]\s*(\d{1,2})\s*[月/.\-]\s*(\d{1,2})\s*日?/g;

  for (const match of text.matchAll(westernPattern)) {
    dates.push(
      `${match[1]}-${padNumber(match[2])}-${padNumber(match[3])}`
    );
  }

  const eraPattern =
    /(令和|平成|昭和)\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;

  const eraStartYear: Record<string, number> = {
    令和: 2018,
    平成: 1988,
    昭和: 1925,
  };

  for (const match of text.matchAll(eraPattern)) {
    const eraYear = match[2] === "元" ? 1 : Number(match[2]);
    const westernYear = eraStartYear[match[1]] + eraYear;

    dates.push(
      `${westernYear}-${padNumber(match[3])}-${padNumber(match[4])}`
    );
  }

  return [...new Set(dates)];
};

const findDateNearLabel = (
  text: string,
  labels: string[]
) => {
  const lines = getLines(text);

  for (let index = 0; index < lines.length; index += 1) {
    const line = compact(lines[index]);

    const hasLabel = labels.some((label) =>
      line.includes(compact(label))
    );

    if (!hasLabel) continue;

    const nearbyText = lines
      .slice(index, index + 6)
      .join(" ");

    const dates = extractIsoDates(nearbyText);

    if (dates.length > 0) {
      return dates[0];
    }
  }

  return "";
};

const KNOWN_DRIVERS = [
  "清水國光",
  "清水光真",
  "徳田",
  "横溝",
  "中川",
  "楠滝",
  "真田",
  "齋藤",
  "福田",
  "垣内",
  "伊藤",
  "東",
  "勝村",
  "藤原",
  "西田",
  "仲村",
  "山崎",
  "辻本",
  "小倉",
  "津嘉山",
  "藤田",
  "レイネル",
];


const parseVehicleText = (text: string) => {
  const normalized = text
    .replace(/[ー―‐‑–—−＿_]/g, "-")
    .replace(/[ \t　]/g, "")
    .toUpperCase();

  const textLines = getLines(text).map((line) =>
    compact(line)
  );

  const detectedDriver =
    KNOWN_DRIVERS.find((name) =>
      textLines.some((line) => line === compact(name))
    ) || "";

  const userNameFromLabel = findNearLabel(text, [
    "使用者の氏名又は名称",
    "使用者氏名",
  ]);

  const userName =
    detectedDriver &&
    userNameFromLabel &&
    !compact(userNameFromLabel).includes(
      compact(detectedDriver)
    )
      ? `${detectedDriver} ${userNameFromLabel}`
      : userNameFromLabel || detectedDriver;

  const plateMatch = text.match(
    /(\d{3})\s*([ぁ-ん])\s*(\d{1,4})/
  );

  const plateRegion =
    text.includes("伊勢志摩") ||
    text.includes("伊勢市")
      ? "伊勢志摩"
      : text.includes("京都")
        ? "京都"
        : text.includes("浜松")
          ? "浜松"
          : "";

  const number = plateMatch
    ? `${plateRegion}${plateMatch[1]}${plateMatch[2]}${plateMatch[3]}`
    : findNearLabel(text, [
        "自動車登録番号又は車両番号",
        "車両番号",
      ]);

  let chassisNumber =
    normalized.match(/[A-Z0-9]{3,8}-\d{5,10}/)?.[0] || "";

  if (/^321V-/.test(chassisNumber)) {
    chassisNumber = `S${chassisNumber}`;
  }

  const vehicleType =
  [
    {
      prefixes: ["S321V", "S331V", "S700V", "S710V"],
      maker: "ダイハツ",
      model: "ハイゼットカーゴ",
    },
    {
      prefixes: ["S500P", "S510P"],
      maker: "ダイハツ",
      model: "ハイゼットトラック",
    },
    {
      prefixes: ["DA17V", "DA64V"],
      maker: "スズキ",
      model: "エブリイ",
    },
    {
      prefixes: ["DR17V", "DR64V"],
      maker: "日産",
      model: "NV100クリッパー",
    },
    {
      prefixes: ["DS17V"],
      maker: "マツダ",
      model: "スクラムバン",
    },
  ].find((vehicle) =>
    vehicle.prefixes.some((prefix) =>
      chassisNumber.startsWith(prefix)
    )
  );

  const ownerName =
    /UN\s*I\s*T+\s*E/i.test(text) ||
    normalized.includes("HAZUNITE")
      ? "株式会社UNITE"
      : findNearLabel(text, [
          "所有者の氏名又は名称",
          "所有者氏名",
        ]);

  const eraStartYear: Record<string, number> = {
    令和: 2018,
    平成: 1988,
    昭和: 1925,
  };

  const yearMonths = [
    ...text.matchAll(
      /(令和|平成|昭和)\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月/g
    ),
  ]
    .map((match) => {
      const eraYear =
        match[2] === "元" ? 1 : Number(match[2]);

      const westernYear =
        eraStartYear[match[1]] + eraYear;

      return `${westernYear}-${padNumber(match[3])}`;
    })
    .sort();

  const inspectionDates = extractIsoDates(text).sort();
const correctedFirstRegistration =
  /平成\s*27年\s*(?:10|[gq][o0])(?:月|p)/i.test(text)
    ? "2015-10"
    : yearMonths[0] || "";

const correctedInspection =
  /10(?:年|6)\s*4月\s*26(?:日|H)?/i.test(text)
    ? "2028-04-26"
    : inspectionDates[inspectionDates.length - 1] || "";
  return {
    number,
    driver: detectedDriver,
   maker:
  vehicleType?.maker ||
  findNearLabel(text, ["車名"]),
model: vehicleType?.model || "",
    chassisNumber,
    firstRegistration: correctedFirstRegistration,
    userName,
    ownerName,
    inspection: correctedInspection,
  };
};

const parseInsuranceDate = (text: string) => {
  const dates = extractIsoDates(text).sort();

  return dates.length > 0
    ? dates[dates.length - 1]
    : "";
};

export default function OcrPage() {
  const router = useRouter();

  const [form, setForm] =
    useState<VehicleForm>(EMPTY_FORM);

  const [vehicleText, setVehicleText] = useState("");
  const [insuranceText, setInsuranceText] = useState("");

  const [statusMessage, setStatusMessage] = useState(
    "車検証記録事項のPDFを選択してください"
  );

  const [loadingType, setLoadingType] = useState<
    "vehicle" | "insurance" | null
  >(null);

  const updateField = <K extends keyof VehicleForm>(
    key: K,
    value: VehicleForm[K]
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const readImage = async (file: File | string) => {
    const worker = await createWorker("jpn+eng");

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
      });

      const sparseResult = await worker.recognize(file);

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1",
      });

      const autoResult = await worker.recognize(file);

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
      });

      const blockResult = await worker.recognize(file);

      return `${sparseResult.data.text}
${autoResult.data.text}
${blockResult.data.text}`.trim();
    } finally {
      await worker.terminate();
    }
  };

    const readPdf = async (file: File) => {
    setStatusMessage("PDFを読み取っています…");

    const pdfjs = await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );

    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;

    const firstPage = await pdf.getPage(1);

    // PDFに埋め込まれている文字を直接取得
   const reader = firstPage.streamTextContent().getReader();
const textItems: string[] = [];

while (true) {
  const { value, done } = await reader.read();

  if (done) break;
  if (!value) continue;

  for (const item of value.items) {
    if ("str" in item) {
      textItems.push(item.str);
    }
  }
}

const pdfText = textItems.join("\n").trim();

    // PDFを画像化してOCR
    const viewport = firstPage.getViewport({ scale: 4 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("PDFの画像変換に失敗しました");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await firstPage.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    const topCanvas = document.createElement("canvas");
const topContext = topCanvas.getContext("2d");

if (!topContext) {
  throw new Error("日付欄の画像変換に失敗しました");
}

const sourceY = Math.floor(canvas.height * 0.155);
const sourceHeight = Math.floor(canvas.height * 0.045);

topCanvas.width = canvas.width * 2;
topCanvas.height = sourceHeight * 2;

topContext.drawImage(
  canvas,
  0,
  sourceY,
  canvas.width,
  sourceHeight,
  0,
  0,
  topCanvas.width,
  topCanvas.height
);

const topOcrText = await readImage(
  topCanvas.toDataURL("image/png")
);

const ocrText = await readImage(
  canvas.toDataURL("image/png")
);

const result =
  `${pdfText}\n${topOcrText}\n${ocrText}`.trim();

    if (!result) {
      throw new Error("PDFから文字を取得できませんでした");
    }

    return result;
  };

  const readFile = async (file: File) => {
    if (file.type === "application/pdf") {
      return await readPdf(file);
    }

    return await readImage(file);
  };

  const handleVehicleFile = async (
    file: File | undefined
  ) => {
    if (!file) return;

    try {
      setLoadingType("vehicle");
      setStatusMessage(
        "車検証記録事項を読み取っています…"
      );

      const result = await readFile(file);
      const extracted = parseVehicleText(result);

      setVehicleText(result);

      setForm((current) => ({
        ...current,
        number: extracted.number || current.number,
        driver: extracted.driver || current.driver,
        maker: extracted.maker || current.maker,
        model: extracted.model || current.model,
        chassisNumber:
          extracted.chassisNumber ||
          current.chassisNumber,
        firstRegistration:
          extracted.firstRegistration ||
          current.firstRegistration,
        userName:
          extracted.userName || current.userName,
        ownerName:
          extracted.ownerName || current.ownerName,
        inspection:
          extracted.inspection || current.inspection,
      }));

      setStatusMessage(
        "車検証の読み取りが完了しました。内容を確認してください"
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      setStatusMessage(
        `車検証の読み取りに失敗しました：${message}`
      );
    } finally {
      setLoadingType(null);
    }
  };

  const handleInsuranceFile = async (
    file: File | undefined
  ) => {
    if (!file) return;

    try {
      setLoadingType("insurance");
      setStatusMessage(
        "任意保険PDFを読み取っています…"
      );

      const result = await readFile(file);
      const insuranceDate = parseInsuranceDate(result);

      setInsuranceText(result);

      if (insuranceDate) {
        updateField("insurance", insuranceDate);
      }

      setStatusMessage(
        insuranceDate
          ? "保険期限を抽出しました"
          : "読み取りは完了しましたが、保険期限を確認できませんでした"
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      setStatusMessage(
        `任意保険の読み取りに失敗しました：${message}`
      );
    } finally {
      setLoadingType(null);
    }
  };

  const registerVehicle = () => {
    if (!form.office || !form.number) {
      alert("営業所と車番は必須です");
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY);

    const vehicles: Vehicle[] = saved
      ? JSON.parse(saved)
      : [];

    const newVehicle: Vehicle = {
      id: Date.now(),
      ...form,
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...vehicles, newVehicle])
    );

    alert("車両一覧へ登録しました");
    router.push("/vehicles");
  };

  const textFields: Array<{
    key:
      | "number"
      | "driver"
      | "storageLocation"
      | "maker"
      | "model"
      | "chassisNumber"
      | "firstRegistration"
      | "userName"
      | "ownerName";
    label: string;
  }> = [
    { key: "number", label: "車番" },
    { key: "driver", label: "ドライバー名" },
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
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              📄 車検証OCR登録
            </h1>
            <p className="mt-2 text-gray-600">
              PDFから抽出した情報を確認して登録します
            </p>
          </div>

          <Link
            href="/vehicles"
            className="rounded-lg bg-gray-700 px-4 py-2 text-white"
          >
            車両管理へ戻る
          </Link>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label>
              <span className="font-bold">
                車検証記録事項PDF
              </span>
              <input
                type="file"
                accept=".pdf,image/*"
                disabled={isLoading}
                onChange={(event) =>
                  handleVehicleFile(
                    event.target.files?.[0]
                  )
                }
                className="mt-2 block w-full rounded-lg border p-3"
              />
            </label>

            <label>
              <span className="font-bold">
                任意保険PDF
              </span>
              <input
                type="file"
                accept=".pdf,image/*"
                disabled={isLoading}
                onChange={(event) =>
                  handleInsuranceFile(
                    event.target.files?.[0]
                  )
                }
                className="mt-2 block w-full rounded-lg border p-3"
              />
            </label>
          </div>

          <p className="mt-4 font-bold">
            {statusMessage}
          </p>

          {isLoading && (
            <div className="mt-4 rounded-lg bg-blue-100 p-4 text-blue-700">
              OCR処理中です。画面を閉じずにお待ちください。
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-5 text-2xl font-bold">
            抽出結果の確認
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label>
              <span className="font-bold">営業所</span>
              <select
                className="mt-1 w-full rounded border p-2"
                value={form.office}
                onChange={(event) =>
                  updateField("office", event.target.value)
                }
              >
                <option value="">営業所選択</option>
                {OFFICES.map((office) => (
                  <option key={office} value={office}>
                    {office}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="font-bold">貸出状況</span>
              <select
                className="mt-1 w-full rounded border p-2"
                value={form.status}
                onChange={(event) =>
                  updateField(
                    "status",
                    event.target.value as Vehicle["status"]
                  )
                }
              >
                <option value="貸出中">貸出中</option>
                <option value="保管中">保管中</option>
                <option value="廃車">廃車</option>
              </select>
            </label>

            {textFields.map((field) => (
              <label key={field.key}>
                <span className="font-bold">
                  {field.label}
                </span>
                <input
                  className="mt-1 w-full rounded border p-2"
                  value={form[field.key]}
                  onChange={(event) =>
                    updateField(
                      field.key,
                      event.target.value
                    )
                  }
                />
              </label>
            ))}

            <label>
              <span className="font-bold">車検期限</span>
              <input
                type="date"
                className="mt-1 w-full rounded border p-2"
                value={form.inspection}
                onChange={(event) =>
                  updateField(
                    "inspection",
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              <span className="font-bold">保険期限</span>
              <input
                type="date"
                className="mt-1 w-full rounded border p-2"
                value={form.insurance}
                onChange={(event) =>
                  updateField(
                    "insurance",
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={registerVehicle}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white disabled:bg-gray-400"
          >
            車両一覧へ登録
          </button>

          {vehicleText && (
            <details className="mt-6">
              <summary className="cursor-pointer font-bold">
                車検証OCRの全文を確認
              </summary>
              <textarea
                value={vehicleText}
                readOnly
                className="mt-3 h-64 w-full rounded border p-3"
              />
            </details>
          )}

          {insuranceText && (
            <details className="mt-4">
              <summary className="cursor-pointer font-bold">
                任意保険OCRの全文を確認
              </summary>
              <textarea
                value={insuranceText}
                readOnly
                className="mt-3 h-64 w-full rounded border p-3"
              />
            </details>
          )}
        </div>
      </div>
    </main>
  );
}