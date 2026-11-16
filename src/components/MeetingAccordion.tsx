"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Tag } from "@/components/UI";

export type MeetingAccordionItem = {
  id: string;
  meetingNumber: number;
  type: string;
  dateLabel: string;
  summaryPreview: string;
  live: boolean;
  taskCount: number;
  refCount: number;
  body: ReactNode;
};

/**
 * Click-to-expand accordion for class meetings so opening a course
 * does not render every historical meeting expanded simultaneously.
 */
export function MeetingAccordion({
  items,
  defaultOpenId = null,
}: {
  items: MeetingAccordionItem[];
  defaultOpenId?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId);
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    const syncHash = () => {
      const match = /^#pertemuan-(\d+)$/.exec(window.location.hash);
      if (!match) return;
      const target = items.find(
        (item) => item.meetingNumber === Number(match[1])
      );
      if (!target) return;
      setExpandAll(false);
      setOpenId(target.id);
      requestAnimationFrame(() => {
        document
          .getElementById(`pertemuan-${target.meetingNumber}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [items]);

  const toggle = (id: string) => {
    if (expandAll) {
      setExpandAll(false);
      setOpenId(id);
      return;
    }
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="meeting-acc-wrap">
      {items.length > 1 && (
        <div className="meeting-acc-toolbar">
          <span className="subtle tiny">
            Klik pertemuan untuk membuka BAP, presensi, dan tugas.
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setExpandAll((v) => !v);
              if (expandAll) setOpenId(null);
            }}
          >
            <i
              className={`bi ${
                expandAll ? "bi-arrows-collapse" : "bi-arrows-expand"
              }`}
            />
            {expandAll ? "Tutup Semua" : "Buka Semua"}
          </button>
        </div>
      )}

      <div className="meeting-acc-list">
        {items.map((item) => {
          const isOpen = expandAll || openId === item.id;
          return (
            <div
              className={`meeting-acc-item ${isOpen ? "open" : ""}`}
              id={`pertemuan-${item.meetingNumber}`}
              key={item.id}
            >
              <button
                type="button"
                className="meeting-acc-trigger"
                aria-expanded={isOpen}
                onClick={() => toggle(item.id)}
              >
                <div className="meeting-n">
                  {String(item.meetingNumber).padStart(2, "0")}
                </div>
                <div className="meeting-acc-meta">
                  <div className="meeting-acc-title">
                    {item.type} · Pertemuan ke-{item.meetingNumber}
                  </div>
                  <div className="meeting-acc-sub">
                    {item.dateLabel}
                    {item.summaryPreview ? ` · ${item.summaryPreview}` : ""}
                  </div>
                </div>
                <div className="meeting-acc-right">
                  {item.taskCount > 0 && (
                    <Tag kind="blue">{item.taskCount} Tugas</Tag>
                  )}
                  {item.refCount > 0 && (
                    <Tag kind="neutral">{item.refCount} Ref</Tag>
                  )}
                  <Tag kind={item.live ? "live" : "neutral"}>
                    {item.live ? "LIVE" : "Terkunci"}
                  </Tag>
                  <i
                    className={`bi ${
                      isOpen ? "bi-chevron-up" : "bi-chevron-down"
                    } meeting-acc-chevron`}
                    aria-hidden="true"
                  />
                </div>
              </button>

              {isOpen && <div className="meeting-acc-body">{item.body}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
