import { Dashboard } from "@/components/dashboard/dashboard";
import { loadAll } from "@/lib/load";

// 데이터 파일이 매일 바뀌므로 요청마다 다시 읽는다.
export const dynamic = "force-dynamic";

export default async function Page() {
  const { meta, center, benchmark } = await loadAll();
  return <Dashboard meta={meta} center={center} benchmark={benchmark} />;
}
