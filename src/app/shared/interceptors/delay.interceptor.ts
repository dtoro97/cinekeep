import { HttpInterceptorFn } from '@angular/common/http';
import { delay } from 'rxjs/operators';

export const delayInterceptor: HttpInterceptorFn = (req, next) => {
    return next(req)
        .pipe
        //delay(1000), // delay all responses by 1 second
        ();
};
