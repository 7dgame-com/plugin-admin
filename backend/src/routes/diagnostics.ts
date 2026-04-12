import { Router } from 'express';
import { getDiagnostics } from '../controllers/diagnostics';

const router = Router();

router.get('/', getDiagnostics);

export default router;
