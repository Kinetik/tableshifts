import { FlowbiteIndividualTableShiftsApp } from "@/components/flowbite-individual-tableshifts";

export default function Home() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.tableshifts_dbSUPABASE_URL ||
    "";
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.tableshifts_dbSUPABASE_ANON_KEY ||
    process.env.tableshifts_dbSUPABASE_PUBLISHABLE_KEY ||
    "";

  return <FlowbiteIndividualTableShiftsApp supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey} />;
}
