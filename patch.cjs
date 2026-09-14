const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

const newSave = `
function useSave(table: string) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async (initialRow: Record<string, unknown>) => {
      console.log(\`[ADMIN SAVE DIAGNOSTIC] Initiating save to table '\${table}'\`);
      console.log(\`[ADMIN SAVE DIAGNOSTIC] Initial Payload:\`, initialRow);
      
      if (!supabase) {
        console.error(\`[ADMIN SAVE DIAGNOSTIC] Supabase client is not connected!\`);
        throw new Error("Backend not connected");
      }
      
      const row = { ...initialRow };
      if (table === "products") {
        delete row["launch_time"];
        delete row["timer_image_url"];

        const parseJson = (val: unknown) => {
          if (typeof val !== "string" || !val.trim()) return [];
          try {
            return JSON.parse(val);
          } catch {
            return [val];
          }
        };

        if ("features" in row) row.features = parseJson(row.features);
        if ("file_info" in row) row.file_info = parseJson(row.file_info);
        if ("how_to_use" in row) row.how_to_use = parseJson(row.how_to_use);
        
        console.log(\`[ADMIN SAVE DIAGNOSTIC] Parsed JSON array fields for products. Processed payload:\`, row);
      }

      let attempts = 0;
      while (attempts < 5) {
        attempts++;
        console.log(\`[ADMIN SAVE DIAGNOSTIC] Save attempt \${attempts}...\`);
        
        const query = row["id"]
          ? supabase.from(table).update(row).eq("id", row["id"] as string).select()
          : supabase.from(table).insert(row).select();
          
        const { error, data } = await query;

        if (error) {
          console.error(\`[ADMIN SAVE DIAGNOSTIC] Supabase Error received:\`, error);
          
          const match = error.message?.match(/Could not find the '([^']+)' column/i);
          if (match && match[1] && match[1] in row) {
            console.warn(\`[ADMIN SAVE DIAGNOSTIC] Column '\${match[1]}' not in \${table} table, stripping and retrying...\`);
            delete row[match[1]];
            continue;
          }
          throw error;
        }

        if (!data || data.length === 0) {
          console.error(\`[ADMIN SAVE DIAGNOSTIC] Update returned 0 rows! This usually means Row Level Security (RLS) blocked the update, or the ID does not exist.\`);
          throw new Error("Save failed: No rows were updated. Check your permissions.");
        }
        
        console.log(\`[ADMIN SAVE DIAGNOSTIC] Save successful! Returned data:\`, data);
        return data;
      }
      
      throw new Error("Save failed after 5 retries due to schema mismatch");
    },
    onSuccess: () => {
      toast.success("Saved successfully");
      void qc.invalidateQueries({ queryKey: ["admin-table"] });
      void qc.invalidateQueries({ queryKey: ["store-catalog"] });
      
      fetch("/api/admin/clear-cache", { method: "POST" }).catch(console.error);
      
      router.invalidate();
    },
    onError: (err) => {
      console.error("[ADMIN SAVE DIAGNOSTIC] Mutation onError triggered:", err);
      toast.error(err.message || "Failed to save");
    },
  });
}
`;

code = code.replace(/function useSaveOld\(table: string\) \{[\s\S]*?onError: \(e: unknown\) => toast\.error\(e instanceof Error \? e\.message : "Save failed"\),\n  \}\);\n\}/, newSave);

fs.writeFileSync('src/routes/admin.tsx', code);
