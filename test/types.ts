import { IncomingMessage, ServerResponse } from "node:http";
import { expectTypeOf } from "expect-type";
import Router from "..";
import { ErrorRequestHandler } from "../lib/route";

const router = Router();

router.get("/", function (req, res) {
  expectTypeOf(req).toEqualTypeOf<IncomingMessage>();
  expectTypeOf(res).toEqualTypeOf<ServerResponse>();
});

router.get("/", function (req, res, next) {
  expectTypeOf(req).toEqualTypeOf<IncomingMessage>();
  expectTypeOf(res).toEqualTypeOf<ServerResponse>();
  expectTypeOf(next).toBeFunction();
});

// typescript has no way to infer the types automatically
router.get<ErrorRequestHandler>("/", function (err, req, res, next) {
  expectTypeOf(err).toEqualTypeOf<Error>();
  expectTypeOf(req).toEqualTypeOf<IncomingMessage>();
  expectTypeOf(res).toEqualTypeOf<ServerResponse>();
  expectTypeOf(next).toBeFunction();
});
