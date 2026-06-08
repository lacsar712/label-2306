<template>
  <el-empty :description="description" :image-size="imageSize">
    <template v-if="$slots.image" #image>
      <slot name="image" />
    </template>
    <template v-if="$slots.default" #description>
      <slot />
    </template>
    <template v-if="$slots.action" #footer>
      <slot name="action" />
    </template>
  </el-empty>
</template>

<script setup>
defineProps({
  description: {
    type: String,
    default: '暂无数据',
  },
  imageSize: {
    type: Number,
    default: 80,
  },
});
</script>

<style scoped>
</style>
