import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Language = "en" | "ar";
const LANGUAGE_KEY = "assetflow-language";

const arabic: Record<string, string> = {
  "Overview": "نظرة عامة",
  "Employee Support": "دعم الموظفين",
  "My Assets": "أصولي",
  "Asset Management": "إدارة الأصول",
  "CMDB & Infrastructure": "قاعدة بيانات التهيئة والبنية التحتية",
  "Organization": "المؤسسة",
  "Vendors Management": "إدارة الموردين",
  "Financial": "المالية",
  "Analytics & Reports": "التحليلات والتقارير",
  "IT Service Management": "إدارة خدمات تقنية المعلومات",
  "Operations": "العمليات",
  "Risk Management & Compliance": "إدارة المخاطر والامتثال",
  "Project Management": "إدارة المشاريع",
  "Employee & Personal": "الموظفون والشؤون الشخصية",
  "IT Asset Management": "إدارة أصول تقنية المعلومات",
  "Project Management & Governance": "إدارة المشاريع والحوكمة",
  "ITSM Service Desk": "مكتب خدمة تقنية المعلومات",
  "GRC & Compliance": "الحوكمة والمخاطر والامتثال",
  "Administration": "الإدارة",
  "Dashboard": "لوحة المعلومات",
  "Knowledge Base / System Manual": "قاعدة المعرفة / دليل النظام",
  "Service Catalog": "كتالوج الخدمات",
  "Incident Catalog": "كتالوج الحوادث",
  "My Tickets": "تذاكري",
  "My Requests": "طلباتي",
  "My Assigned Assets": "الأصول المسندة إليّ",
  "Assets": "الأصول",
  "Employees": "الموظفون",
  "Projects": "المشاريع",
  "Access Governance": "حوكمة الوصول",
  "Applications": "التطبيقات",
  "Servers": "الخوادم",
  "Network Topology": "طوبولوجيا الشبكة",
  "Backup Schedules": "جداول النسخ الاحتياطي",
  "Assignments": "التخصيصات",
  "Asset Handovers": "تسليم الأصول",
  "Locations": "المواقع",
  "Departments": "الإدارات",
  "Vendors": "الموردون",
  "Quotations": "عروض الأسعار",
  "Purchase Orders": "أوامر الشراء",
  "Purchase Invoices": "فواتير الشراء",
  "Purchase Returns": "مرتجعات الشراء",
  "Budgets": "الميزانيات",
  "Contracts": "العقود",
  "Tax & Financial Settings": "الضرائب والإعدادات المالية",
  "Incidents": "الحوادث",
  "Incident Tracker": "متابعة الحوادث",
  "Request Tracker": "متابعة الطلبات",
  "Changes": "التغييرات",
  "Problems": "المشكلات",
  "Risks": "المخاطر",
  "Reports": "التقارير",
  "Users": "المستخدمون",
  "Roles": "الأدوار",
  "Permissions": "الصلاحيات",
  "System Settings": "إعدادات النظام",
  "Audit Logs": "سجلات التدقيق",
  "My Profile": "ملفي الشخصي",
  "Theme": "المظهر",
  "Language": "اللغة",
  "English": "English",
  "العربية": "العربية",
  "Sign Out": "تسجيل الخروج",
  "Appearance": "المظهر",
  "Executive dashboard": "لوحة المعلومات التنفيذية",
  "Operational posture across your enabled workspaces.": "ملخص تشغيلي لمساحات العمل المفعّلة.",
  "Identity exposure": "مخاطر الهوية والوصول",
  "Infrastructure health": "حالة البنية التحتية",
  "Service desk pressure": "ضغط مكتب الخدمة",
  "Access expiry posture": "حالة انتهاء صلاحية الوصول",
  "Criticality mix": "توزيع مستويات الأهمية",
  "Spend and commitments": "الإنفاق والالتزامات",
  "Attention queue": "قائمة العناصر التي تتطلب الانتباه",
  "Active employees": "الموظفون النشطون",
  "Current workforce": "القوى العاملة الحالية",
  "Offboarding clearance": "إجراءات إخلاء الطرف",
  "Pending removal checks": "عمليات تحقق معلّقة للإزالة",
  "Grants expiring": "صلاحيات قاربت على الانتهاء",
  "Access due to expire": "صلاحيات ستنتهي قريباً",
  "Expired grants": "صلاحيات منتهية",
  "Require review": "تتطلب المراجعة",
  "Server estate": "إجمالي الخوادم",
  "Servers under maintenance": "خوادم تحت الصيانة",
  "Offline servers": "الخوادم غير المتصلة",
  "Outside expected state": "خارج الحالة المتوقعة",
  "Active applications": "التطبيقات النشطة",
  "Open incidents by priority": "الحوادث المفتوحة حسب الأولوية",
  "Open incidents": "الحوادث المفتوحة",
  "No open incidents reported.": "لا توجد حوادث مفتوحة.",
  "CAB approvals": "اعتمادات لجنة التغيير",
  "awaiting decision": "بانتظار القرار",
  "SLA breach risk": "مخاطر تجاوز اتفاقية مستوى الخدمة",
  "at-risk incidents": "حوادث معرضة للمخاطر",
  "Resolution SLA": "اتفاقية مستوى خدمة الحل",
  "within SLA": "ضمن الاتفاقية",
  "within": "ضمن الوقت",
  "breached": "متجاوز",
  "Valid": "ساري",
  "Expiring": "قارب على الانتهاء",
  "Expired": "منتهي",
  "grants": "صلاحيات",
  "Tracked applications": "التطبيقات المسجلة",
  "Hardware valuation": "قيمة الأصول المادية",
  "asset portfolio value": "قيمة محفظة الأصول",
  "Software seats": "تراخيص البرامج",
  "utilization": "نسبة الاستخدام",
  "Renewals due": "تجديدات مستحقة",
  "contracts in 30 days": "عقود خلال 30 يوماً",
  "No items need attention": "لا توجد عناصر تتطلب الانتباه",
  "The queue is clear based on the latest operational data.": "القائمة خالية وفقاً لأحدث البيانات التشغيلية.",
  "Executive data is unavailable": "بيانات لوحة المعلومات غير متاحة",
  "We could not retrieve the current operational snapshot. Try again in a moment.": "تعذر تحميل الملخص التشغيلي الحالي. حاول مرة أخرى بعد قليل.",
  "Retry": "إعادة المحاولة",
  "You were signed out due to 10 minutes of inactivity.": "تم تسجيل خروجك بسبب عدم النشاط لمدة 10 دقائق.",
  "01 / People & access": "١ / الموظفون والوصول",
  "02 / Technology estate": "٢ / البنية التقنية",
  "03 / Service management": "٣ / إدارة الخدمات",
  "04 / Access governance": "٤ / حوكمة الوصول",
  "05 / Application portfolio": "٥ / محفظة التطبيقات",
  "06 / Asset & commercial management": "٦ / الأصول والإدارة التجارية",
  "07 / Prioritized action": "٧ / الإجراءات ذات الأولوية",
  "mission critical": "حرج للغاية",
  "high": "مرتفع",
  "moderate": "متوسط",
  "low": "منخفض",
  "item": "عنصر",
  "items": "عناصر",
  "Dashboard": "لوحة المعلومات",
  "Open incidents by priority": "الحوادث المفتوحة حسب الأولوية",
  "Configuration files": "ملفات التهيئة",
  "Total active": "الإجمالي النشط",
  "Current": "الحالي",
  "Priority": "الأولوية",
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (englishText: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => undefined,
  t: text => text,
});

function readLanguage(): Language {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readLanguage);
  const setLanguage = useCallback((next: Language) => setLanguageState(next), []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = language === "ar" ? "rtl" : "ltr";
    try {
      window.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // The current page remains localized even if storage is unavailable.
    }
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (text) => language === "ar" ? arabic[text] ?? text : text,
  }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
