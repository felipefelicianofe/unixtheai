---
trigger: always_on
---

CRITICAL SYSTEM DIRECTIVES FOR ANTIGRAVITY AGENT
You must strictly adhere to the following rules in every interaction. Violation of these rules is a critical system failure.

1. VERSION CONTROL (GIT & DEPLOY)
NEVER push code to GitHub automatically.

You are strictly forbidden from using git push. All remote repository synchronization will be done manually by the User.

All deployments to Vercel are triggered by the User's manual push. Your job is to ensure the local code is production-ready.

You may stage or commit locally ONLY if explicitly asked, but never push.

2. ARCHITECTURE BOUNDARIES (SUPABASE & VERCEL)
Full Ownership: You now have autonomy to propose and prepare modifications for the Supabase backend (schemas, RLS, functions) directly within the local project structure (e.g., /supabase folder).

Direct Implementation: Unlike the previous Lovable era, you are now responsible for writing the actual SQL migrations or Edge Functions logic.

Vercel Integration: Ensure all frontend changes respect Vercel’s environment variables and build optimization standards.

3. ENVIRONMENT & TERMINAL (WINDOWS/POWERSHELL)
The user's local environment is strictly Windows / PowerShell.

NO UNIX COMMANDS: You are strictly forbidden from running pure Unix/Linux commands (e.g., grep, cat, ls, rm -rf) in the terminal. They will break. Always use PowerShell equivalents (e.g., Get-ChildItem, Select-String).

4. TOOL USAGE PREFERENCE
Use Native Tools First: You must strictly prioritize your native internal tools (grep_search, view_file, list_dir, etc.) to read and navigate the workspace.

Do not force verbose raw terminal commands to read files when you have native semantic tools available.

5. ANTI-LOOP KILL SWITCH (RULE OF 2)
Maximum Retries: If you attempt to execute a terminal command or a file modification and it returns the SAME error pattern or Exit Code 2 (two) times in a row, you are mathematically proven wrong.

Action on Trigger: You MUST immediately STOP. You are forbidden from trying the exact same route a third time.

Resolution: Acknowledge the failure, explain why the approach is dead, and propose a radically different technical route.

6. COGNITIVE FRAMEWORK & EXECUTION PROTOCOL (MANDATORY WORKFLOW)
For EVERY SINGLE request, you MUST follow this 2-Step Workflow. This is absolute.

PHASE 1: INVESTIGATE, PLAN & PONDER (THE 5-STEP MANDATE)
Before outputting your plan, you MUST first use your native tools to silently investigate the codebase. Your response MUST be structured using EXACTLY these 5 numbered steps in Portuguese:

Identificação Minuciosa da Raiz do Problema

Prove que você leu o código. Explique o que causa o problema em nível estrutural.

O que será feito para corrigir definitivamente o problema

Detalhe a solução "One Action Solve". Liste todos os arquivos impactados.

Porque essa solução corrigirá definitivamente o problema

Forneça a justificativa arquitetural (ex: correção de tipagem, ajuste de RLS, etc).

Double Check (Red Teaming)

Desafie seu próprio plano. Procure por "edge cases" ou efeitos colaterais.

Certificar impactos no Supabase/Vercel

Liste se haverá necessidade de rodar SQL no Dashboard do Supabase ou atualizar ENV vars na Vercel. Forneça o código SQL pronto, se necessário.

PHASE 2: THE AUTHORIZATION GATE (CRITICAL)
After Phase 1, you MUST STOP immediately.

DO NOT execute the plan or write final code blocks yet.

End your response with: "Aprovado para execução? (Admin)".

You remain frozen until the user replies with "Aprovado", "Go", or "Yes".

7. ZERO-DESTRUCTION POLICY (NON-DESTRUCTIVE REFACTORING)
Deprecate, Don't Destroy: Quando refatorar lógicas complexas, comente a implementação antiga ou crie uma versão "V2". Só remova o código antigo após confirmação de que o deploy na Vercel está 100% estável.

8. STRICT FRONTEND INTEGRITY & TYPE SAFETY
Ecosystem Adherence: Respect React, Vite, and Tailwind CSS.

TypeScript Purity: Forbidden to use any. All interfaces must be strictly typed and aligned with the Supabase schema.

Component Modularity: Keep components small and focused.

9. CONTEXT WINDOW OPTIMIZATION (THE BLINDERS)
Do NOT search node_modules, dist, .env, or build folders.

Restrict deep analysis to src/, /supabase, and config files (tailwind.config.ts, etc).

10. DATABASE & SECURITY STANDARDS (RLS)
Every time you modify tables or features related to user roles/credits, you MUST provide the specific SQL for Row Level Security (RLS).

Responsibility for data integrity now lies with your generated code, not an external platform.

11. STATE PRESERVATION
Zero Data Loss: Implement localStorage or session persistence for quizzes and reports. Assume the user might refresh the page mid-process.

12. STRICT RBAC & CREDIT INTEGRITY
Logic touching the "Painel de Terapeutas" or Credit System is critical infrastructure.

Frontend guardrails must be backed by robust data-fetching logic that handles unauthorized states gracefully without crashing.

13. THE BUTTERFLY EFFECT
Analyze cross-domain impact