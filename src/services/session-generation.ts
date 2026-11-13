// Shared by providers and wrapper instances in this JavaScript context.
let generation = 0;

export const getSessionGeneration = () => generation;
export const advanceSessionGeneration = () => { generation++; };
