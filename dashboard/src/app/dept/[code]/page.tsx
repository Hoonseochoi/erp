import { notFound } from "next/navigation";

import { DeptView } from "@/components/org/dept-view";
import { loadDept, loadIndex } from "@/lib/load";

export const dynamic = "force-dynamic";

/** 데이터 로딩만 try 안에서 한다. JSX 를 try 로 감싸면 렌더 에러를 못 잡는다. */
async function fetchOr404(code: string) {
  try {
    return await Promise.all([loadDept(code), loadIndex()]);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const got = await fetchOr404(code);
  return { title: got ? `${got[0].name} · 매출 대시보드` : "매출 대시보드" };
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const got = await fetchOr404(code);
  if (!got) notFound();
  const [data, index] = got;
  return <DeptView data={data} index={index} />;
}
