import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type DirectoryProfile = {
  user_id: string;
  full_name: string;
  username: string | null;
  assigned_area: string | null;
};

export type DirectoryUserRole = {
  user_id: string;
  role: Database['public']['Enums']['app_role'];
};

export type SignaturePublicKey = {
  user_id: string;
  public_key: string;
  is_active: boolean;
};

let profilesCache: DirectoryProfile[] | null = null;
let rolesCache: DirectoryUserRole[] | null = null;
let keysCache: SignaturePublicKey[] | null = null;

export function clearDirectoryCache() {
  profilesCache = null;
  rolesCache = null;
  keysCache = null;
}

export async function fetchDirectoryProfiles(force = false): Promise<DirectoryProfile[]> {
  if (!force && profilesCache) return profilesCache;
  const { data } = await supabase.rpc('get_directory_profiles');
  profilesCache = (data as DirectoryProfile[] | null) ?? [];
  return profilesCache;
}

export async function fetchDirectoryUserRoles(force = false): Promise<DirectoryUserRole[]> {
  if (!force && rolesCache) return rolesCache;
  const { data } = await supabase.rpc('get_directory_user_roles');
  rolesCache = (data as DirectoryUserRole[] | null) ?? [];
  return rolesCache;
}

export async function fetchSignaturePublicKeys(force = false): Promise<SignaturePublicKey[]> {
  if (!force && keysCache) return keysCache;
  const { data } = await supabase.rpc('get_signature_public_keys');
  keysCache = (data as SignaturePublicKey[] | null) ?? [];
  return keysCache;
}
