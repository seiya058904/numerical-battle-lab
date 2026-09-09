'use strict';

const mean=values=>values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);
const rmse=values=>Math.sqrt(mean(values.map(value=>value*value)));

function fitLinearScaleV7(rows){
  if(!rows.length)throw new Error('training rows are required');
  const rawMean=mean(rows.map(row=>row.raw)),targetMean=mean(rows.map(row=>row.target));
  const variance=mean(rows.map(row=>(row.raw-rawMean)**2));
  const covariance=mean(rows.map(row=>(row.raw-rawMean)*(row.target-targetMean)));
  const slope=variance>1e-12?covariance/variance:1;
  return {slope,intercept:targetMean-slope*rawMean};
}

function solveLinearSystem(matrix,vector){
  const n=vector.length,a=matrix.map((row,index)=>[...row,vector[index]]);
  for(let column=0;column<n;column++){
    let pivot=column;
    for(let row=column+1;row<n;row++)if(Math.abs(a[row][column])>Math.abs(a[pivot][column]))pivot=row;
    if(Math.abs(a[pivot][column])<1e-12)continue;
    [a[column],a[pivot]]=[a[pivot],a[column]];
    const divisor=a[column][column];
    for(let j=column;j<=n;j++)a[column][j]/=divisor;
    for(let row=0;row<n;row++)if(row!==column){const factor=a[row][column];for(let j=column;j<=n;j++)a[row][j]-=factor*a[column][j];}
  }
  return a.map((row,index)=>Math.abs(row[index])<1e-12?0:row[n]);
}

function trainRidge(rows,lambda){
  if(!rows.length)throw new Error('training rows are required');
  const width=rows[0].features.length;
  const means=Array.from({length:width},(_,i)=>mean(rows.map(row=>row.features[i])));
  const scales=means.map((value,i)=>Math.sqrt(mean(rows.map(row=>(row.features[i]-value)**2)))||1);
  const design=rows.map(row=>[1,...row.features.map((value,i)=>(value-means[i])/scales[i])]);
  const size=width+1,matrix=Array.from({length:size},()=>Array(size).fill(0)),vector=Array(size).fill(0);
  for(let r=0;r<rows.length;r++)for(let i=0;i<size;i++){
    vector[i]+=design[r][i]*rows[r].outcome;
    for(let j=0;j<size;j++)matrix[i][j]+=design[r][i]*design[r][j];
  }
  for(let i=1;i<size;i++)matrix[i][i]+=lambda;
  const [intercept,...coefficients]=solveLinearSystem(matrix,vector);
  return {intercept,coefficients,means,scales,lambda};
}

function predictRidgeV7(model,features){
  return model.intercept+features.reduce((sum,value,i)=>sum+((value-model.means[i])/model.scales[i])*model.coefficients[i],0);
}

function evaluate(model,rows){
  const errors=rows.map(row=>predictRidgeV7(model,row.features)-row.outcome);
  return {count:rows.length,rmse:rmse(errors),mae:mean(errors.map(Math.abs))};
}

function fitRidgeCalibrationV7(train,validation,test,lambdas=[.01,.1,1,10]){
  let best=null;
  for(const lambda of lambdas){
    const model=trainRidge(train,lambda),validationMetrics=evaluate(model,validation);
    if(!best||validationMetrics.rmse<best.validationMetrics.rmse)best={model,validationMetrics};
  }
  return {model:best.model,metrics:{train:evaluate(best.model,train),validation:best.validationMetrics,test:evaluate(best.model,test)}};
}

module.exports={fitLinearScaleV7,fitRidgeCalibrationV7,predictRidgeV7};
