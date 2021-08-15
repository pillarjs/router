import { IncomingMessage, ServerResponse } from "http";

type handler = (req:IncomingMessage, res:ServerResponse, next:Function) => void

interface Router {
    (req:IncomingMessage, res:ServerResponse, next:Function):Router
    get(path:string|handler[]|handler, handlers?:handler|handler[], handler?:handler):Router
    post(path:string|handler[]|handler, handlers?:handler|handler[], handler?:handler):Router
    put(path:string|handler[]|handler, handlers?:handler|handler[], handler?:handler):Router
    patch(path:string|handler[]|handler, handlers?:handler|handler[], handler?:handler):Router
    delete(path:string|handler[]|handler, handlers?:handler|handler[], handler?:handler):Router
    route(path:string):Router
    all(handler:|handler[]):Router
    use(path:string|handler[]|handler, handler:handler|handler[]):Router

}
interface RouterOptions {
    /**
     * Enable case sensitivity.
     */
    caseSensitive?: boolean | undefined;

    /**
     * Preserve the req.params values from the parent router.
     * If the parent and the child have conflicting param names, the child’s value take precedence.
     *
     * @default false
     * @since 4.5.0
     */
    mergeParams?: boolean | undefined;

    /**
     * Enable strict routing.
     */
    strict?: boolean | undefined;
}
declare function Router(options?:RouterOptions):Router
export = Router
