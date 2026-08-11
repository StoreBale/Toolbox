import { handleAdmin } from '../../server/admin.js';

export const onRequest = ({ request, env }) => handleAdmin(request, env);
