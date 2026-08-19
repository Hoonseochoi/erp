import { TeamView } from "@/components/org/team-view";
import { loadIndex, loadTeam } from "@/lib/load";

// 데이터 파일이 매일 바뀌므로 요청마다 다시 읽는다.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await loadTeam();
  return { title: `${t.name} · 매출 대시보드` };
}

export default async function Page() {
  const [team, index] = await Promise.all([loadTeam(), loadIndex()]);
  return <TeamView data={team} index={index} />;
}
