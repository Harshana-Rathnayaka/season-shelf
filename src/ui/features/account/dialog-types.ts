export interface LoginSuggestion { id: string; phone: string; apiId: string | number }
export interface SavedLogin { apiId: string | number; apiHash: string; phone: string }
export type AccountDialog =
  | { kind: "connect"; hasCredentials: boolean; suggestions: LoginSuggestion[]; saved?: SavedLogin }
  | { kind: "auth"; id: string; label: string; authKind: string }
  | { kind: "preview" };
