import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';

export function useAsyncRequest(asyncFn, options = {}) {
  const config = reactive({
    immediate: false,
    successMessage: '',
    errorMessage: '',
    showSuccess: false,
    showError: false,
    initialData: null,
    onSuccess: null,
    onError: null,
    ...options,
  });

  const loading = ref(false);
  const data = ref(config.initialData);
  const error = ref(null);

  const execute = async (...args) => {
    loading.value = true;
    error.value = null;
    try {
      const result = await asyncFn(...args);
      data.value = result;
      if (config.showSuccess && config.successMessage) {
        ElMessage.success(config.successMessage);
      }
      if (config.onSuccess) {
        config.onSuccess(result);
      }
      return result;
    } catch (e) {
      error.value = e;
      if (config.showError && config.errorMessage) {
        ElMessage.error(config.errorMessage);
      }
      if (config.onError) {
        config.onError(e);
      }
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const reset = () => {
    loading.value = false;
    data.value = config.initialData;
    error.value = null;
  };

  if (config.immediate) {
    execute();
  }

  return {
    loading,
    data,
    error,
    config,
    execute,
    reset,
  };
}
