-- The restore RPC enforces authentication, account ownership, and agent role.
GRANT EXECUTE ON FUNCTION public.restore_contact(UUID) TO authenticated;
