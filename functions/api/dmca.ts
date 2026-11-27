import { type FormPagesContext, handleFormSubmission } from '../_lib/forms.ts';
import { optionsResponse } from '../_lib/normalize.ts';

export const onRequestOptions = async (): Promise<Response> => {
  return optionsResponse();
};

export const onRequestPost = async (context: FormPagesContext): Promise<Response> => {
  return handleFormSubmission('dmca', context);
};
