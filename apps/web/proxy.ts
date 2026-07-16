import {NextResponse} from "next/server";
import {REQUEST_ID_HEADER, TRACEPARENT_HEADER} from "@forgedandfound/logger/trace";
import {auth} from "@/auth";

export const proxy = auth((request) => {
  const requestId = request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({request: {headers: forwardedHeaders}});
  response.headers.set(REQUEST_ID_HEADER, requestId);

  const traceparent = request.headers.get(TRACEPARENT_HEADER);
  if (traceparent) {
    response.headers.set(TRACEPARENT_HEADER, traceparent);
  }

  return response;
});
