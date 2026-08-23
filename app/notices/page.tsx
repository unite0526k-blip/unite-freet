"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Vehicle = {
  id: number;
  office: string;
  number: string;
  maker: string;
  model: string;
  driver: string;
  inspection: string;
  insurance: string;
};

type Notice = {
  id: string;
  number: string;
  driver: string;
  type: "車検" | "保険";
  date: string;
  days: number;
};

const STORAGE_KEY = "unite-fleet-vehicles";

function getDaysLeft(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(`${date}T00:00:00`);
  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    const vehicles: Vehicle[] = JSON.parse(saved);
    const list: Notice[] = [];

    vehicles.forEach((vehicle) => {
      if (vehicle.inspection) {
        const days = getDaysLeft(vehicle.inspection);

        if (days <= 30) {
          list.push({
            id: `${vehicle.id}-inspection`,
            number: vehicle.number,
            driver: vehicle.driver,
            type: "車検",
            date: vehicle.inspection,
            days,
          });
        }
      }

      if (vehicle.insurance) {
        const days = getDaysLeft(vehicle.insurance);

        if (days <= 30) {
          list.push({
            id: `${vehicle.id}-insurance`,
            number: vehicle.number,
            driver: vehicle.driver,
            type: "保険",
            date: vehicle.insurance,
            days,
          });
        }
      }
    });

    list.sort((a, b) => a.days - b.days);
    setNotices(list);
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">🔔 期限通知</h1>
            <p className="mt-2 text-gray-600">
              期限まで30日以内の車検・保険
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg bg-gray-700 px-4 py-2 text-white"
          >
            ダッシュボードへ戻る
          </Link>
        </div>

        {notices.length === 0 ? (
          <div className="rounded-xl bg-white p-6 shadow">
            現在、期限が近い車検・保険はありません。
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow">
            <table className="w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-3 text-left">車両番号</th>
                  <th className="p-3 text-left">担当者</th>
                  <th className="p-3 text-left">種類</th>
                  <th className="p-3 text-left">期限日</th>
                  <th className="p-3 text-left">残り日数</th>
                </tr>
              </thead>

              <tbody>
                {notices.map((notice) => (
                  <tr key={notice.id} className="border-t">
                    <td className="p-3">{notice.number}</td>
                    <td className="p-3">{notice.driver || "未設定"}</td>
                    <td className="p-3 font-bold">{notice.type}</td>
                    <td className="p-3">{notice.date}</td>
                    <td
                      className={`p-3 font-bold ${
                        notice.days < 0
                          ? "text-red-700"
                          : notice.days <= 7
                            ? "text-red-500"
                            : "text-orange-500"
                      }`}
                    >
                      {notice.days < 0
                        ? `${Math.abs(notice.days)}日超過`
                        : notice.days === 0
                          ? "本日"
                          : `あと${notice.days}日`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}