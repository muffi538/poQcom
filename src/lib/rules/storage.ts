import { promises as fs } from "fs";
import path from "path";
import { Rule, RuleGroup, RuleHistoryEntry } from "@/types/rules";

// Placeholder persistence: a JSON file on disk. This is here so the Rules
// Builder UI has somewhere to read/write during development. It should be
// swapped for a real database once one is chosen (see open questions) —
// a JSON file has no concurrent-write safety and won't survive most
// deployment targets.
const DATA_DIR = path.join(process.cwd(), ".data");
const RULES_FILE = path.join(DATA_DIR, "rules.json");
const GROUPS_FILE = path.join(DATA_DIR, "rule-groups.json");
const HISTORY_FILE = path.join(DATA_DIR, "rule-history.json");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const text = await fs.readFile(file, "utf-8");
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

export async function listRules(): Promise<Rule[]> {
  return readJson<Rule[]>(RULES_FILE, []);
}

export async function saveRules(rules: Rule[]): Promise<void> {
  await writeJson(RULES_FILE, rules);
}

export async function listRuleGroups(): Promise<RuleGroup[]> {
  return readJson<RuleGroup[]>(GROUPS_FILE, []);
}

export async function saveRuleGroups(groups: RuleGroup[]): Promise<void> {
  await writeJson(GROUPS_FILE, groups);
}

export async function listRuleHistory(): Promise<RuleHistoryEntry[]> {
  return readJson<RuleHistoryEntry[]>(HISTORY_FILE, []);
}

export async function appendRuleHistory(entry: RuleHistoryEntry): Promise<void> {
  const history = await listRuleHistory();
  history.push(entry);
  await writeJson(HISTORY_FILE, history);
}
