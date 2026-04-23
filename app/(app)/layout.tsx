import { TabBar } from "@/components/ui/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-20">{children}</div>
      <TabBar />
    </>
  );
}
